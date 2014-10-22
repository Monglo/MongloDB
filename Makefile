
build: components index.js
	@./node_modules/.bin/component	build -s monglo -n monglo

components: component.json
	@./node_modules/.bin/component install --dev

clean:
	rm -fr build components

.PHONY: clean
