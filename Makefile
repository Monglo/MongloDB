SRC = lib/*
REPORTER = list

all: clean monglo.js monglo.min.js test-docs test-cov test

clean:
	rm -f dist/* && \
	rm -rf dist-cov && \
	rm -f docs/coverage.html \
	rm -f docs/test.html

test:
	@NODE_ENV=test ./node_modules/.bin/mocha \
		--reporter $(REPORTER) \
		--require should \
		--growl

test-docs:
	$(MAKE) test REPORTER=doc \
		| cat docs/head.html - docs/tail.html \
		> docs/test.html

test-cov: dist-cov
	@MONGLODB_COV=1 $(MAKE) test REPORTER=html-cov > docs/coverage.html

dist-cov:
	@jscoverage dist dist-cov

monglo.js: $(SRC)
	cat $^ > dist/$@

monglo.min.js: monglo.js
	uglifyjs --no-mangle dist/$< > dist/$@

build: monglo.js monglo.min.js

.PHONY: clean test test-docs build