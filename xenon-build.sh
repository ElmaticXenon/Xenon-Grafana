# If the Pipeline gives us a Tag, use this as the Xenon version
if [ -n "$CI_BUILD_TAG" ]; then
  sed -i "s/^\(  \"version\": \"\).*\(\",\)$/\1$CI_BUILD_TAG\2/" package.json
fi

# If a Pipeline ID exists, pass this to the build container
if [ -n "$CI_PIPELINE_ID" ]; then
  DOCKER_BUILDKIT=1 docker build --cpuset-cpus "0-11" --tag $HUB_ADDRESS:$CI_PIPELINE_ID --build-arg CI_PIPELINE_ID=$CI_PIPELINE_ID .
else
  DOCKER_BUILDKIT=1 docker build --cpuset-cpus --tag xenon:dev .
fi