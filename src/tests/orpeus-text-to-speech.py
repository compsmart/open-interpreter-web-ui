import requests

url = "http://192.168.1.126:5005/speak"
payload = {
    "text": "Hello, this is Orpheus speaking!",
    "voice": "tara",
    "format": "mp3",
    "model": "orpheus-3b-0.1-ft"
}

response = requests.post(url, json=payload)
with open("output.mp3", "wb") as f:
    f.write(response.content)
