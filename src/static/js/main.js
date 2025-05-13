// This file contains JavaScript code for the web UI, handling user interactions and making AJAX calls to the backend.

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('code-form');
    const codeInput = document.getElementById('code-input');
    const outputArea = document.getElementById('output-area');

    form.addEventListener('submit', function(event) {
        event.preventDefault();
        const code = codeInput.value;

        fetch('/execute', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ code: code }),
        })
        .then(response => response.json())
        .then(data => {
            outputArea.textContent = data.output;
        })
        .catch(error => {
            outputArea.textContent = 'Error: ' + error.message;
        });
    });
});