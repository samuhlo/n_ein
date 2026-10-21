from datetime import datetime

def display_date(timestamp):
    return datetime.fromisoformat(timestamp).strftime("%Y-%m-%d")
