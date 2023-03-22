package api

import (
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"golang.org/x/oauth2"

	"github.com/grafana/grafana/pkg/infra/metrics"
	"github.com/grafana/grafana/pkg/middleware/cookies"
	"github.com/grafana/grafana/pkg/services/authn"
	contextmodel "github.com/grafana/grafana/pkg/services/contexthandler/model"
	"github.com/grafana/grafana/pkg/web"
)

const (
	OauthStateCookieName = "oauth_state"
	OauthPKCECookieName  = "oauth_code_verifier"
)

func (hs *HTTPServer) OAuthLogin(reqCtx *contextmodel.ReqContext) {
	name := web.Params(reqCtx.Req)[":name"]

	if errorParam := reqCtx.Query("error"); errorParam != "" {
		errorDesc := reqCtx.Query("error_description")
		hs.log.Error("failed to login ", "error", errorParam, "errorDesc", errorDesc)

		hs.redirectWithError(reqCtx, errors.New("login provider denied login request"), "error", errorParam, "errorDesc", errorDesc)
		return
	}

	code := reqCtx.Query("code")

	req := &authn.Request{HTTPRequest: reqCtx.Req, Resp: reqCtx.Resp}
	if code == "" {
		redirect, err := hs.authnService.RedirectURL(reqCtx.Req.Context(), authn.ClientWithPrefix(name), req)
		if err != nil {
			reqCtx.Redirect(hs.redirectURLWithErrorCookie(reqCtx, err))
			return
		}

		cookies.WriteCookie(reqCtx.Resp, OauthStateCookieName, redirect.Extra[authn.KeyOAuthState], hs.Cfg.OAuthCookieMaxAge, hs.CookieOptionsFromCfg)

		if pkce := redirect.Extra[authn.KeyOAuthPKCE]; pkce != "" {
			cookies.WriteCookie(reqCtx.Resp, OauthPKCECookieName, pkce, hs.Cfg.OAuthCookieMaxAge, hs.CookieOptionsFromCfg)
		}

		reqCtx.Redirect(redirect.URL)
		return
	}

	identity, err := hs.authnService.Login(reqCtx.Req.Context(), authn.ClientWithPrefix(name), req)
	// NOTE: always delete these cookies, even if login failed
	cookies.DeleteCookie(reqCtx.Resp, OauthStateCookieName, hs.CookieOptionsFromCfg)
	cookies.DeleteCookie(reqCtx.Resp, OauthPKCECookieName, hs.CookieOptionsFromCfg)

	if err != nil {
		reqCtx.Redirect(hs.redirectURLWithErrorCookie(reqCtx, err))
		return
	}

	metrics.MApiLoginOAuth.Inc()
	authn.HandleLoginRedirect(reqCtx.Req, reqCtx.Resp, hs.Cfg, identity, hs.ValidateRedirectTo)
		return
	}

	provider := hs.SocialService.GetOAuthInfoProvider(name)
	if provider == nil {
		hs.handleOAuthLoginErrorWithRedirect(reqCtx, loginInfo, errors.New("OAuth not enabled"))
		return
	}

	connect, err := hs.SocialService.GetConnector(name)
	if err != nil {
		hs.handleOAuthLoginErrorWithRedirect(reqCtx, loginInfo, fmt.Errorf("no OAuth with name %s configured", name))
		return
	}

	if code == "" {
		var opts []oauth2.AuthCodeOption
		if provider.UsePKCE {
			ascii, pkce, err := genPKCECode()
			if err != nil {
				reqCtx.Logger.Error("Generating PKCE failed", "error", err)
				hs.handleOAuthLoginError(reqCtx, loginInfo, LoginError{
					HttpStatus:    http.StatusInternalServerError,
					PublicMessage: "An internal error occurred",
				})
				return
			}

			cookies.WriteCookie(reqCtx.Resp, OauthPKCECookieName, ascii, hs.Cfg.OAuthCookieMaxAge, hs.CookieOptionsFromCfg)

			opts = append(opts,
				oauth2.SetAuthURLParam("code_challenge", pkce),
				oauth2.SetAuthURLParam("code_challenge_method", "S256"),
			)
		}

		state, err := GenStateString()
		if err != nil {
			reqCtx.Logger.Error("Generating state string failed", "err", err)
			hs.handleOAuthLoginError(reqCtx, loginInfo, LoginError{
				HttpStatus:    http.StatusInternalServerError,
				PublicMessage: "An internal error occurred",
			})
			return
		}

		hashedState := hs.hashStatecode(state, provider.ClientSecret)
		cookies.WriteCookie(reqCtx.Resp, OauthStateCookieName, hashedState, hs.Cfg.OAuthCookieMaxAge, hs.CookieOptionsFromCfg)
		if provider.HostedDomain != "" {
			opts = append(opts, oauth2.SetAuthURLParam("hd", provider.HostedDomain))
		}

		reqCtx.Redirect(connect.AuthCodeURL(state, opts...))
		return
	}

	cookieState := reqCtx.GetCookie(OauthStateCookieName)

	// delete cookie
	cookies.DeleteCookie(reqCtx.Resp, OauthStateCookieName, hs.CookieOptionsFromCfg)

	if cookieState == "" {
		hs.handleOAuthLoginError(reqCtx, loginInfo, LoginError{
			HttpStatus:    http.StatusInternalServerError,
			PublicMessage: "login.OAuthLogin(missing saved state)",
		})
		return
	}

	queryState := hs.hashStatecode(reqCtx.Query("state"), provider.ClientSecret)
	oauthLogger.Info("state check", "queryState", queryState, "cookieState", cookieState)
	if cookieState != queryState {
		hs.handleOAuthLoginError(reqCtx, loginInfo, LoginError{
			HttpStatus:    http.StatusInternalServerError,
			PublicMessage: "login.OAuthLogin(state mismatch)",
		})
		return
	}

	oauthClient, err := hs.SocialService.GetOAuthHttpClient(name)
	if err != nil {
		reqCtx.Logger.Error("Failed to create OAuth http client", "error", err)
		hs.handleOAuthLoginError(reqCtx, loginInfo, LoginError{
			HttpStatus:    http.StatusInternalServerError,
			PublicMessage: "login.OAuthLogin(" + err.Error() + ")",
		})
		return
	}

	ctx := reqCtx.Req.Context()
	oauthCtx := context.WithValue(ctx, oauth2.HTTPClient, oauthClient)
	opts := []oauth2.AuthCodeOption{}

	codeVerifier := reqCtx.GetCookie(OauthPKCECookieName)
	cookies.DeleteCookie(reqCtx.Resp, OauthPKCECookieName, hs.CookieOptionsFromCfg)
	if codeVerifier != "" {
		opts = append(opts,
			oauth2.SetAuthURLParam("code_verifier", codeVerifier),
		)
	}

	// get token from provider
	token, err := connect.Exchange(oauthCtx, code, opts...)
	if err != nil {
		hs.handleOAuthLoginError(reqCtx, loginInfo, LoginError{
			HttpStatus:    http.StatusInternalServerError,
			PublicMessage: "login.OAuthLogin(NewTransportWithCode)",
			Err:           err,
		})
		return
	}
	// token.TokenType was defaulting to "bearer", which is out of spec, so we explicitly set to "Bearer"
	token.TokenType = "Bearer"

	if hs.Cfg.Env != setting.Dev {
		oauthLogger.Debug("OAuthLogin: got token",
			"expiry", fmt.Sprintf("%v", token.Expiry),
			"type", token.TokenType,
			"has_refresh_token", token.RefreshToken != "",
		)
	} else {
		oauthLogger.Debug("OAuthLogin: got token",
			"expiry", fmt.Sprintf("%v", token.Expiry),
			"type", token.TokenType,
			"access_token", fmt.Sprintf("%v", token.AccessToken),
			"refresh_token", fmt.Sprintf("%v", token.RefreshToken),
		)
	}

	// set up oauth2 client
	client := connect.Client(oauthCtx, token)

	// get user info
	userInfo, err := connect.UserInfo(ctx, client, token)
	if err != nil {
		var sErr *social.Error
		if errors.As(err, &sErr) {
			hs.handleOAuthLoginErrorWithRedirect(reqCtx, loginInfo, sErr)
		} else {
			hs.handleOAuthLoginError(reqCtx, loginInfo, LoginError{
				HttpStatus:    http.StatusInternalServerError,
				PublicMessage: fmt.Sprintf("login.OAuthLogin(get info from %s)", name),
				Err:           err,
			})
		}
		return
	}

	oauthLogger.Debug("OAuthLogin got user info", "userInfo", fmt.Sprintf("%v", userInfo))

	// validate that we got at least an email address
	if userInfo.Email == "" {
		hs.handleOAuthLoginErrorWithRedirect(reqCtx, loginInfo, login.ErrNoEmail)
		return
	}

	// validate that the email is allowed to login to grafana
	if !connect.IsEmailAllowed(userInfo.Email) {
		hs.handleOAuthLoginErrorWithRedirect(reqCtx, loginInfo, login.ErrEmailNotAllowed)
		return
	}

	loginInfo.ExternalUser = *hs.buildExternalUserInfo(token, userInfo, name)
	loginInfo.User, err = hs.SyncUser(reqCtx, &loginInfo.ExternalUser, connect)
	if err != nil {
		hs.handleOAuthLoginErrorWithRedirect(reqCtx, loginInfo, err)
		return
	}

	// login
	if err := hs.loginUserWithUser(loginInfo.User, reqCtx); err != nil {
		hs.handleOAuthLoginErrorWithRedirect(reqCtx, loginInfo, err)
		return
	}

	loginInfo.HTTPStatus = http.StatusOK
	hs.HooksService.RunLoginHook(&loginInfo, reqCtx)
	metrics.MApiLoginOAuth.Inc()

	reqCtx.Redirect(hs.GetRedirectURL(reqCtx))
}

// buildExternalUserInfo returns a ExternalUserInfo struct from OAuth user profile
func (hs *HTTPServer) buildExternalUserInfo(token *oauth2.Token, userInfo *social.BasicUserInfo, name string) *loginservice.ExternalUserInfo {
	oauthLogger.Debug("Building external user info from OAuth user info")

	extUser := &loginservice.ExternalUserInfo{
		AuthModule:     fmt.Sprintf("oauth_%s", name),
		OAuthToken:     token,
		AuthId:         userInfo.Id,
		Name:           userInfo.Name,
		Login:          userInfo.Login,
		Email:          userInfo.Email,
		OrgRoles:       map[int64]org.RoleType{},
		Groups:         userInfo.Groups,
		IsGrafanaAdmin: userInfo.IsGrafanaAdmin,
	}

	if userInfo.Role != "" && !hs.Cfg.OAuthSkipOrgRoleUpdateSync {
		rt := userInfo.Role
		if rt.IsValid() {
			// The user will be assigned a role in either the auto-assigned organization or in the default one
			var orgID int64
			if hs.Cfg.AutoAssignOrg && hs.Cfg.AutoAssignOrgId > 0 {
				orgID = int64(hs.Cfg.AutoAssignOrgId)
				plog.Debug("The user has a role assignment and organization membership is auto-assigned",
					"role", userInfo.Role, "orgId", orgID)
			} else {
				orgID = int64(1)
				plog.Debug("The user has a role assignment and organization membership is not auto-assigned",
					"role", userInfo.Role, "orgId", orgID)
			}
			extUser.OrgRoles[orgID] = rt
		}
	} else {
		// The structure of the group attribute is supposted to be as follows:
		// <OrgId>:<RoleType> -> 1:admin 2:viewer [...]
		for _, orgGroup := range userInfo.Groups {
			// split the pairs apart
			orgGroupSplit := strings.Fields(strings.ReplaceAll(orgGroup, ":", " "))
			if len(orgGroupSplit) == 0 {
				plog.Debug("Some went wrong reading groups/orgs from userInfo! GO on", "orgGroupSplit", orgGroupSplit)
				continue
			}
			orgId, _ := strconv.Atoi(orgGroupSplit[0])
			// Transfer gathered info into OrgRoles map
			extUser.OrgRoles[int64(orgId)] = org.RoleType(orgGroupSplit[1])
		}
	}

	return extUser
}

// SyncUser syncs a Grafana user profile with the corresponding OAuth profile.
func (hs *HTTPServer) SyncUser(
	ctx *contextmodel.ReqContext,
	extUser *loginservice.ExternalUserInfo,
	connect social.SocialConnector,
) (*user.User, error) {
	oauthLogger.Debug("Syncing Grafana user with corresponding OAuth profile")
	lookupParams := loginservice.UserLookupParams{}
	if hs.Cfg.OAuthAllowInsecureEmailLookup {
		lookupParams.Email = &extUser.Email
	}

	// add/update user in Grafana
	cmd := &loginservice.UpsertUserCommand{
		ReqContext:       ctx,
		ExternalUser:     extUser,
		SignupAllowed:    connect.IsSignupAllowed(),
		UserLookupParams: lookupParams,
	}

	upsertedUser, err := hs.Login.UpsertUser(ctx.Req.Context(), cmd)
	if err != nil {
		return nil, err
	}

	// Do not expose disabled status,
	// just show incorrect user credentials error (see #17947)
	if upsertedUser.IsDisabled {
		oauthLogger.Warn("User is disabled", "user", upsertedUser.Login)
		return nil, login.ErrInvalidCredentials
	}

	return upsertedUser, nil
}

func (hs *HTTPServer) hashStatecode(code, seed string) string {
	hashBytes := sha256.Sum256([]byte(code + hs.Cfg.SecretKey + seed))
	return hex.EncodeToString(hashBytes[:])
}

type LoginError struct {
	HttpStatus    int
	PublicMessage string
	Err           error
}

func (hs *HTTPServer) handleOAuthLoginError(ctx *contextmodel.ReqContext, info loginservice.LoginInfo, err LoginError) {
	ctx.Handle(hs.Cfg, err.HttpStatus, err.PublicMessage, err.Err)

	// login hooks is handled by authn.Service
	if !hs.Cfg.AuthBrokerEnabled {
		info.Error = err.Err
		if info.Error == nil {
			info.Error = errors.New(err.PublicMessage)
		}
		info.HTTPStatus = err.HttpStatus

		hs.HooksService.RunLoginHook(&info, ctx)
	}
}

func (hs *HTTPServer) handleOAuthLoginErrorWithRedirect(ctx *contextmodel.ReqContext, info loginservice.LoginInfo, err error, v ...interface{}) {
	hs.redirectWithError(ctx, err, v...)

	// login hooks is handled by authn.Service
	if !hs.Cfg.AuthBrokerEnabled {
		info.Error = err
		hs.HooksService.RunLoginHook(&info, ctx)
	}
}
