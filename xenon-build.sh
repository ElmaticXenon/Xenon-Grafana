# If the Pipeline gives us a Tag, use this as the Xenon version
if [ -n "$CI_BUILD_TAG" ]; then
  sed -i "s/^\(  \"version\": \"\).*\(\",\)$/\1$CI_BUILD_TAG\2/" package.json
fi

# If a Pipeline ID exists, pass this to the build container
if [ -n "$CI_PIPELINE_ID" ]; then
  docker build --tag $HUB_ADDRESS:$CI_PIPELINE_ID --build-arg CI_PIPELINE_ID=$CI_PIPELINE_ID .
else
  docker build --tag xenon:dev .
fi