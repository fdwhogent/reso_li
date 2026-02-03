// Poll creation logic for reso_li

class CreatePollApp {
    constructor() {
        this.poll = null;
        this.password = null;
        this.questions = [];
        this.editor = null;

        this.init();
    }

    init() {
        this.bindEvents();
        this.editor = new RichTextEditor('editorToolbar', 'questionContent');
    }

    bindEvents() {
        // Access code preview
        const accessCodeInput = document.getElementById('accessCode');
        const codePreview = document.getElementById('codePreview');

        accessCodeInput.addEventListener('input', () => {
            const code = accessCodeInput.value.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
            accessCodeInput.value = code;
            codePreview.textContent = code || 'yourcode';
        });

        // Create poll
        document.getElementById('createPollBtn').addEventListener('click', () => this.handleCreatePoll());

        // Copy URL
        document.getElementById('copyUrlBtn').addEventListener('click', () => this.handleCopyUrl());

        // Add option
        document.getElementById('addOptionBtn').addEventListener('click', () => this.addOptionRow());

        // Add question
        document.getElementById('addQuestionBtn').addEventListener('click', () => this.handleAddQuestion());

        // Remove option delegation
        document.getElementById('optionsContainer').addEventListener('click', (e) => {
            if (e.target.classList.contains('remove-option-btn')) {
                this.removeOptionRow(e.target);
            }
        });
    }

    async handleCreatePoll() {
        const accessCode = document.getElementById('accessCode').value.trim();
        const password = document.getElementById('password').value;
        const availableFrom = document.getElementById('availableFrom').value || null;
        const availableUntil = document.getElementById('availableUntil').value || null;
        const errorEl = document.getElementById('codeError');

        // Validation
        if (!accessCode) {
            errorEl.textContent = 'Access code is required';
            Utils.showElement(errorEl);
            return;
        }

        if (accessCode.length < 3) {
            errorEl.textContent = 'Access code must be at least 3 characters';
            Utils.showElement(errorEl);
            return;
        }

        if (!password) {
            errorEl.textContent = 'Password is required';
            Utils.showElement(errorEl);
            return;
        }

        Utils.hideElement(errorEl);

        const btn = document.getElementById('createPollBtn');
        btn.disabled = true;
        btn.textContent = 'Creating...';

        try {
            this.poll = await API.createPoll(
                accessCode,
                password,
                availableFrom ? new Date(availableFrom).toISOString() : null,
                availableUntil ? new Date(availableUntil).toISOString() : null
            );

            this.password = password;

            // Show questions step
            Utils.hideElement('setupStep');
            Utils.showElement('questionsStep');

            // Set poll URL
            const baseUrl = window.location.origin;
            const pollUrl = `${baseUrl}/for?poll=${this.poll.accessCode}`;
            document.getElementById('pollUrl').value = pollUrl;

            // Set manage link
            document.getElementById('managePollLink').href = `/manage?poll=${this.poll.accessCode}`;

            // Show empty state
            this.renderQuestionsList();

        } catch (error) {
            errorEl.textContent = error.message || 'Failed to create poll';
            Utils.showElement(errorEl);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Create poll';
        }
    }

    handleCopyUrl() {
        const urlInput = document.getElementById('pollUrl');
        urlInput.select();
        document.execCommand('copy');

        const btn = document.getElementById('copyUrlBtn');
        const originalText = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => {
            btn.textContent = originalText;
        }, 2000);
    }

    addOptionRow() {
        const container = document.getElementById('optionsContainer');
        const optionCount = container.querySelectorAll('.option-row').length + 1;

        const row = document.createElement('div');
        row.className = 'flex gap-1 mb-1 option-row';
        row.innerHTML = `
            <input type="text" class="form-input option-input" placeholder="Option ${optionCount}">
            <button type="button" class="btn btn-secondary btn-sm remove-option-btn">-</button>
        `;

        container.appendChild(row);
        this.updateRemoveButtons();
    }

    removeOptionRow(btn) {
        const row = btn.closest('.option-row');
        if (row) {
            row.remove();
            this.updateRemoveButtons();
            this.renumberOptions();
        }
    }

    updateRemoveButtons() {
        const rows = document.querySelectorAll('.option-row');
        rows.forEach(row => {
            const btn = row.querySelector('.remove-option-btn');
            btn.disabled = rows.length <= 2;
        });
    }

    renumberOptions() {
        const inputs = document.querySelectorAll('.option-input');
        inputs.forEach((input, index) => {
            input.placeholder = `Option ${index + 1}`;
        });
    }

    async handleAddQuestion() {
        const title = document.getElementById('questionTitle').value.trim();
        const content = this.editor.getContent();
        const useMonospace = this.editor.isUsingMonospace();
        const allowMultiple = document.getElementById('allowMultiple').checked;
        const errorEl = document.getElementById('questionError');

        // Get options
        const optionInputs = document.querySelectorAll('.option-input');
        const options = Array.from(optionInputs)
            .map(input => input.value.trim())
            .filter(text => text.length > 0);

        // Validation
        if (!content || content === '<br>') {
            errorEl.textContent = 'Question content is required';
            Utils.showElement(errorEl);
            return;
        }

        if (options.length < 2) {
            errorEl.textContent = 'At least 2 options are required';
            Utils.showElement(errorEl);
            return;
        }

        Utils.hideElement(errorEl);

        const btn = document.getElementById('addQuestionBtn');
        btn.disabled = true;
        btn.textContent = 'Adding...';

        try {
            const question = await API.addQuestion(this.poll.accessCode, this.password, {
                title,
                content,
                useMonospace,
                allowMultiple,
                options
            });

            this.questions.push(question);
            this.renderQuestionsList();
            this.clearQuestionForm();

        } catch (error) {
            errorEl.textContent = error.message || 'Failed to add question';
            Utils.showElement(errorEl);
        } finally {
            btn.disabled = false;
            btn.textContent = 'Add question';
        }
    }

    clearQuestionForm() {
        document.getElementById('questionTitle').value = '';
        this.editor.clear();
        document.getElementById('allowMultiple').checked = false;

        // Reset options
        const container = document.getElementById('optionsContainer');
        container.innerHTML = `
            <div class="flex gap-1 mb-1 option-row">
                <input type="text" class="form-input option-input" placeholder="Option 1">
                <button type="button" class="btn btn-secondary btn-sm remove-option-btn" disabled>-</button>
            </div>
            <div class="flex gap-1 mb-1 option-row">
                <input type="text" class="form-input option-input" placeholder="Option 2">
                <button type="button" class="btn btn-secondary btn-sm remove-option-btn" disabled>-</button>
            </div>
        `;
    }

    renderQuestionsList() {
        const list = document.getElementById('questionsList');
        const noQuestionsMsg = document.getElementById('noQuestionsMsg');

        list.innerHTML = '';

        if (this.questions.length === 0) {
            Utils.showElement(noQuestionsMsg);
        } else {
            Utils.hideElement(noQuestionsMsg);

            this.questions.forEach((q, index) => {
                const item = document.createElement('div');
                item.className = 'question-list-item';
                item.innerHTML = `
                    <span class="question-number">${index + 1}</span>
                    <div class="question-info">
                        <div class="question-title">${Utils.escapeHtml(q.title || 'Untitled question')}</div>
                        <div class="question-meta">${q.options.length} options - ${q.allowMultiple ? 'Multiple choice' : 'Single choice'}</div>
                    </div>
                `;
                list.appendChild(item);
            });
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    new CreatePollApp();
});
