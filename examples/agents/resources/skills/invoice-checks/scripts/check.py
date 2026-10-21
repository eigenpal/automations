import json, sys
invoice = json.loads(sys.argv[1])
print(abs(invoice["subtotal"] + invoice["tax"] - invoice["total"]) <= 0.01)
