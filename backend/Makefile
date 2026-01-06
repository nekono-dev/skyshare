.PHONY: build serve-dev serve-firebase run-firebase deploy-firebase

# Paths / commands
NODE := node
NPM := npm
HACK := ./hack/set-balancing-env.cjs
TSC := npx tsc
ENV_DEV := .env.dev

env-gen:
	$(NODE) $(HACK) --write-env $(ENV_DEV)

serve-firebase: 
	$(MAKE) env-gen ENV_DEV=.env
	$(NPM) run serve:firebase

serve-dev: 
	$(MAKE) env-gen ENV_DEV=.env.dev
	$(NPM) run serve:dev

deploy-firebase:
	$(MAKE) env-gen ENV_DEV=.env
	$(NPM) run deploy:firebase
