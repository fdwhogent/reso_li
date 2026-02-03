// Admin panel logic for reso_li

class AdminApp {
    constructor() {
        this.adminPassword = null;
        this.polls = [];
        this.publicPoll = null;
        this.selectedQuestionId = null;

        this.init();
    }

    async init() {
        this.bindEvents();

        // Check for saved password
        const savedPassword = sessionStorage.getItem('admin_password');
        if (savedPassword) {
            this.adminPassword = savedPassword;
            await this.loadDashboard();
        }
    }

    bindEvents() {
        // Login
        document.getElementById('loginBtn').addEventListener('click', () => this.handleLogin());
        document.getElementById('loginPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });

        // Public poll management
        document.getElementById('setPublicPollBtn').addEventListener('click', () => this.setPublicPoll());
        document.getElementById('removePublicPollBtn').addEventListener('click', () => this.removePublicPoll());

        // Image upload
        document.getElementById('cancelImageBtn').addEventListener('click', () => this.hideImageModal());
        document.getElementById('uploadImageBtn').addEventListener('click', () => this.uploadImage());
        document.getElementById('imageFile').addEventListener('change', (e) => this.previewImage(e));
    }

    async handleLogin() {
        const passwordInput = document.getElementById('loginPassword');
        const errorEl = document.getElementById('loginError');
        const password = passwordInput.value;

        if (!password) {
            errorEl.textContent = 'Password is required';
            Utils.showElement(errorEl);
            return;
        }

        Utils.hideElement(errorEl);

        try {
            await API.adminAuth(password);
            this.adminPassword = password;
            sessionStorage.setItem('admin_password', password);

            document.getElementById('loginModal').classList.remove('show');
            await this.loadDashboard();
        } catch (error) {
            errorEl.textContent = error.message || 'Invalid password';
            Utils.showElement(errorEl);
        }
    }

    async loadDashboard() {
        Utils.showElement('loadingState');

        try {
            // Load all polls
            this.polls = await API.getAllPolls(this.adminPassword);

            // Find public poll
            this.publicPoll = this.polls.find(p => p.isPublic) || null;

            Utils.hideElement('loadingState');
            Utils.showElement('adminDashboard');

            this.renderDashboard();
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            Utils.hideElement('loadingState');
            alert('Failed to load dashboard: ' + error.message);
        }
    }

    renderDashboard() {
        // Update public poll display
        const publicPollCode = document.getElementById('publicPollCode');
        const publicPollManagement = document.getElementById('publicPollManagement');

        if (this.publicPoll) {
            publicPollCode.textContent = this.publicPoll.accessCode;
            Utils.showElement(publicPollManagement);
            this.renderPublicPollQuestions();
        } else {
            publicPollCode.textContent = 'None';
            Utils.hideElement(publicPollManagement);
        }

        // Populate select dropdown
        const select = document.getElementById('selectPublicPoll');
        select.innerHTML = '<option value="">-- Select a poll --</option>';
        this.polls.forEach(poll => {
            const option = document.createElement('option');
            option.value = poll.accessCode;
            option.textContent = poll.accessCode;
            if (poll.isPublic) option.selected = true;
            select.appendChild(option);
        });

        // Set timeout if public poll exists
        if (this.publicPoll?.timeoutMinutes) {
            document.getElementById('timeoutMinutes').value = this.publicPoll.timeoutMinutes;
        }

        // Render polls table
        this.renderPollsTable();
    }

    async renderPublicPollQuestions() {
        if (!this.publicPoll) return;

        // Fetch full poll data
        const poll = await API.getPoll(this.publicPoll.accessCode);
        const container = document.getElementById('publicPollQuestions');
        container.innerHTML = '';

        document.getElementById('addPublicQuestionLink').href = `/ask?poll=${this.publicPoll.accessCode}`;

        if (!poll.questions || poll.questions.length === 0) {
            container.innerHTML = '<p class="text-muted">No questions yet</p>';
            return;
        }

        poll.questions.forEach((q, index) => {
            const totalVotes = q.options.reduce((sum, opt) => sum + opt.voteCount, 0);
            const item = document.createElement('div');
            item.className = 'question-list-item';
            item.innerHTML = `
                <span class="question-number">${index + 1}</span>
                <div class="question-info">
                    <div class="question-title">${Utils.escapeHtml(q.title || 'Untitled question')}</div>
                    <div class="question-meta">
                        ${q.options.length} options - ${totalVotes} votes
                        ${q.imagePath ? ' - Has image' : ''}
                    </div>
                </div>
                <div class="question-actions">
                    <button class="btn btn-secondary btn-sm upload-image-btn" data-id="${q.id}">
                        ${q.imagePath ? 'Change image' : 'Add image'}
                    </button>
                </div>
            `;

            item.querySelector('.upload-image-btn').addEventListener('click', () => {
                this.showImageModal(q.id);
            });

            container.appendChild(item);
        });
    }

    renderPollsTable() {
        const tbody = document.getElementById('pollsTableBody');
        tbody.innerHTML = '';

        if (this.polls.length === 0) {
            tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted">No polls yet</td></tr>';
            return;
        }

        this.polls.forEach(poll => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${Utils.escapeHtml(poll.accessCode)}</strong></td>
                <td>${Utils.formatDate(poll.createdAt)}</td>
                <td>${poll.questionCount}</td>
                <td>${poll.availableFrom ? Utils.formatDate(poll.availableFrom) : '-'}</td>
                <td>${poll.availableUntil ? Utils.formatDate(poll.availableUntil) : '-'}</td>
                <td>${poll.isPublic ? '<strong>Yes</strong>' : 'No'}</td>
                <td>
                    <a href="/manage?poll=${poll.accessCode}" class="btn btn-secondary btn-sm">Manage</a>
                </td>
            `;
            tbody.appendChild(tr);
        });
    }

    async setPublicPoll() {
        const select = document.getElementById('selectPublicPoll');
        const accessCode = select.value;
        const timeoutMinutes = document.getElementById('timeoutMinutes').value || null;

        if (!accessCode) {
            alert('Please select a poll');
            return;
        }

        try {
            await API.setPublicPoll(this.adminPassword, accessCode, timeoutMinutes ? parseInt(timeoutMinutes) : null);
            await this.loadDashboard();
        } catch (error) {
            console.error('Failed to set public poll:', error);
            alert('Failed to set public poll: ' + error.message);
        }
    }

    async removePublicPoll() {
        try {
            const response = await fetch('/api/admin/public', {
                method: 'DELETE',
                headers: { 'X-Admin-Password': this.adminPassword }
            });

            if (!response.ok) {
                throw new Error('Failed to remove public poll');
            }

            await this.loadDashboard();
        } catch (error) {
            console.error('Failed to remove public poll:', error);
            alert('Failed to remove public poll: ' + error.message);
        }
    }

    showImageModal(questionId) {
        this.selectedQuestionId = questionId;
        document.getElementById('imageFile').value = '';
        Utils.hideElement('imagePreview');
        document.getElementById('uploadImageBtn').disabled = true;
        document.getElementById('imageModal').classList.add('show');
    }

    hideImageModal() {
        document.getElementById('imageModal').classList.remove('show');
        this.selectedQuestionId = null;
    }

    previewImage(e) {
        const file = e.target.files[0];
        if (!file) {
            Utils.hideElement('imagePreview');
            document.getElementById('uploadImageBtn').disabled = true;
            return;
        }

        // Validate size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert('File size must be less than 5MB');
            e.target.value = '';
            return;
        }

        // Preview
        const reader = new FileReader();
        reader.onload = (event) => {
            const preview = document.getElementById('imagePreview');
            preview.querySelector('img').src = event.target.result;
            Utils.showElement(preview);
            document.getElementById('uploadImageBtn').disabled = false;
        };
        reader.readAsDataURL(file);
    }

    async uploadImage() {
        const fileInput = document.getElementById('imageFile');
        const file = fileInput.files[0];

        if (!file || !this.selectedQuestionId) return;

        const btn = document.getElementById('uploadImageBtn');
        btn.disabled = true;
        btn.textContent = 'Uploading...';

        try {
            await API.uploadImage(this.selectedQuestionId, this.adminPassword, file);
            this.hideImageModal();
            await this.renderPublicPollQuestions();
        } catch (error) {
            console.error('Failed to upload image:', error);
            alert('Failed to upload image: ' + error.message);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Upload';
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    new AdminApp();
});
