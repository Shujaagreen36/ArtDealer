let csrfToken = '';

fetch('http://localhost:3000/csrf-token')
    .then(res => res.json())
    .then(data => csrfToken = data.csrfToken)
    .catch(err => console.error('Failed to fetch CSRF token:', err));


// 📤 Form Submission with Encryption
document.getElementById('submissionForm').addEventListener('submit', async function(event) {
    event.preventDefault();

    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const genre = document.getElementById('genre').value.trim();
    const file = document.getElementById('file').files[0];

    if (!name || !email || !genre || !file) {
        alert('All fields are required.');
        return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(email)) {
        alert('Please enter a valid email address.');
        return;
    }

    if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB.');
        return;
    }

    const encryptedFile = await encryptFile(file);

    const formData = new FormData();
    formData.append('name', name);
    formData.append('email', email);
    formData.append('genre', genre);
    formData.append('file', encryptedFile);

    const xhr = new XMLHttpRequest();
    
    xhr.open('POST', 'http://localhost:3000/submit', true);


    xhr.setRequestHeader('X-CSRF-Token', csrfToken);

    xhr.upload.onprogress = function(event) {
        if (event.lengthComputable) {
            const percentComplete = (event.loaded / event.total) * 100;
            const progressBar = document.getElementById('progressBar');
            progressBar.style.width = percentComplete + '%';
            progressBar.textContent = Math.floor(percentComplete) + '%';
        }
    };

    xhr.onload = function() {
        if (xhr.status === 200) {
            document.getElementById('success-message').style.display = 'block';
            document.getElementById('progressBar').style.width = '0%';
            document.getElementById('progressBar').textContent = '0%';
            loadSubmissions();
        } else {
            alert('Failed to submit. Please try again.');
        }
    };

    xhr.send(formData);
});

// 🔒 File Encryption
async function encryptFile(file) {
    const arrayBuffer = await file.arrayBuffer();
    const cryptoKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt']);
    const encryptedContent = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: new Uint8Array(12) }, cryptoKey, arrayBuffer);
    return new Blob([new Uint8Array(encryptedContent)], { type: file.type });
}

// 📥 Load Submissions with Secure Download Links
function loadSubmissions() {
    fetch('http://localhost:3000/submissions')
        .then(res => res.json())
        .then(data => {
            const tableBody = document.getElementById('submissionsBody');
            tableBody.innerHTML = '';
            data.forEach((submission, index) => {
                const row = `<tr>
                    <td>${index + 1}</td>
                    <td>${submission.name}</td>
                    <td>${submission.email}</td>
                    <td>${submission.genre}</td>
                    <td><a href="${submission.filepath}" target="_blank">View File</a></td>
                    <td><a href="http://localhost:3000/download/${submission.id}" target="_blank">Secure Download</a></td>
                </tr>`;
                tableBody.innerHTML += row;
            });
        })
        .catch(err => console.error('Failed to load submissions:', err));
}

window.onload = loadSubmissions;
