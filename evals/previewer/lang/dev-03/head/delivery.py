def deliver(client, payload):
    try:
        return client.send(payload)
    except TimeoutError:
        return client.send(payload)
