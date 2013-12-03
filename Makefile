
build: components index.js
	@component build -s monglo -n monglo

components: component.json
	@component install --dev

clean:
	rm -fr build components

.PHONY: clean