#!/bin/sh

# make a request to check if Grafana is still responding
curl -f localhost:3001/api/health