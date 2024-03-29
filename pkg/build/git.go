package build

import (
	"os"
)

func getGitBranch() string {
	v, err := runError("git", "rev-parse", "--abbrev-ref", "HEAD")
	if err != nil {
		return "main"
	}
	return string(v)
}

func getGitSha() string {
	// If there is a pipeline ID set, use this
	idstr, present := os.LookupEnv("CI_PIPELINE_ID")
	if present && idstr != "0" {
		return idstr
	}

	v, err := runError("git", "rev-parse", "--short", "HEAD")
	if err != nil {
		return "unknown-dev"
	}
	return string(v)
}

func getGitEnterpriseSha() string {
	// supporting the old way of dev setup
	v, err := runError("git", "-C", "../grafana-enterprise", "rev-parse", "--short", "HEAD")
	if err != nil {
		// supporting the new way of dev setup
		v, err = runError("git", "-C", "..", "rev-parse", "--short", "HEAD")
		if err != nil {
			return ""
		}
	}
	return string(v)
}
