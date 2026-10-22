from pricing import make_quote

def checkout(cents):
    return make_quote(cents)["total"]
