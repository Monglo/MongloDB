SRC = $(shell find lib -name "*.js" -type f)
UGLIFY = $(shell find node_modules -name "uglifyjs" -type f)
UGLIFY_FLAGS = --no-mangle
REPORTER = dot

all: monglo.min.js

test:
	@./node_modules/.bin/mocha \
		--reporter $(REPORTER)

test-cov: lib-cov
	JADE_COV=1 $(MAKE) test REPORTER=html-cov > coverage.html

lib-cov:
	jscoverage lib lib-cov

benchmark:
	@node support/benchmark

monglo.js: $(SRC)
	@node support/compile.js $^

monglo.min.js: monglo.js
	@$(UGLIFY) $(UGLIFY_FLAGS) $< > $@ \
		&& du -h monglo.js monglo.min.js

clean:
	rm -f monglo.js
	rm -f monglo.min.js

.PHONY: test-cov test benchmark clean