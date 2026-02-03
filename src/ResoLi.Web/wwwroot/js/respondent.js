// Respondent view logic for reso_li

class RespondentApp {
    constructor() {
        this.poll = null;
        this.activeQuestion = null;
        this.selectedOptions = new Set();
        this.hasVoted = false;
        this.connection = new PollConnection();
        this.countdownInterval = null;

        this.init();
    }

    async init() {
        this.bindEvents();
        this.setupSignalR();

        // Check if accessing via code in URL
        const pollCode = Utils.getQueryParam('poll');
        if (pollCode) {
            await this.loadPoll(pollCode);
        } else {
            // Try to load public poll
            await this.loadPublicPoll();
        }
    }

    bindEvents() {
        // Code entry
        const joinBtn = document.getElementById('joinPollBtn');
        const codeInput = document.getElementById('accessCodeInput');

        if (joinBtn) {
            joinBtn.addEventListener('click', () => this.handleJoinPoll());
        }

        if (codeInput) {
            codeInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') this.handleJoinPoll();
            });
        }

        // Submit vote
        const submitBtn = document.getElementById('submitVoteBtn');
        if (submitBtn) {
            submitBtn.addEventListener('click', () => this.handleSubmitVote());
        }
    }

    setupSignalR() {
        this.connection.on('onVoteUpdate', (questionId, results) => {
            // Only update if we're viewing results (after voting)
            if (this.hasVoted && this.activeQuestion?.id === questionId) {
                this.updateResults(results);
            }
        });

        this.connection.on('onQuestionActivated', async (questionId) => {
            // Load and display new active question
            try {
                const question = await API.getQuestion(questionId);
                this.activeQuestion = question;
                this.hasVoted = this.checkIfVoted(questionId);
                this.selectedOptions.clear();
                this.showVotingState();
            } catch (error) {
                console.error('Failed to load activated question:', error);
            }
        });

        this.connection.on('onQuestionDeactivated', () => {
            this.activeQuestion = null;
            this.showWaitingState();
        });
    }

    async handleJoinPoll() {
        const input = document.getElementById('accessCodeInput');
        const errorEl = document.getElementById('codeError');
        const code = input.value.trim();

        if (!code) {
            errorEl.textContent = 'Please enter an access code';
            Utils.showElement(errorEl);
            return;
        }

        Utils.hideElement(errorEl);
        await this.loadPoll(code);
    }

    async loadPublicPoll() {
        try {
            const poll = await API.getPublicPoll();
            this.poll = poll;
            await this.processPoll();
        } catch (error) {
            // No public poll, show code entry
            this.showCodeEntry();
        }
    }

    async loadPoll(code) {
        Utils.showElement('loadingState');
        Utils.hideElement('codeEntry');

        try {
            const poll = await API.getPoll(code);
            this.poll = poll;
            await this.processPoll();
        } catch (error) {
            const errorEl = document.getElementById('codeError');
            errorEl.textContent = error.message || 'Poll not found';
            Utils.showElement(errorEl);
            this.showCodeEntry();
        }
    }

    async processPoll() {
        if (!this.poll) {
            this.showCodeEntry();
            return;
        }

        // Connect to SignalR
        await this.connection.connect(this.poll.accessCode);

        // Check availability
        if (!this.poll.isAvailable) {
            if (this.poll.availableFromUtc && new Date(this.poll.availableFromUtc) > new Date()) {
                this.showCountdown(this.poll.availableFromUtc);
            } else {
                this.showUnavailable();
            }
            return;
        }

        // Find active question
        const activeQuestion = this.poll.questions.find(q => q.isActive);
        if (activeQuestion) {
            this.activeQuestion = activeQuestion;
            this.hasVoted = this.checkIfVoted(activeQuestion.id);
            this.showVotingState();
        } else {
            this.showWaitingState();
        }
    }

    showCodeEntry() {
        this.hideAllStates();
        Utils.showElement('codeEntry');
    }

    showCountdown(targetDate) {
        this.hideAllStates();
        Utils.showElement('countdownState');

        if (this.countdownInterval) {
            clearInterval(this.countdownInterval);
        }

        const update = () => {
            const timerEl = document.getElementById('countdownTimer');
            const remaining = Utils.formatCountdown(targetDate);
            timerEl.textContent = remaining;

            if (remaining === '00:00:00') {
                clearInterval(this.countdownInterval);
                // Reload poll
                this.loadPoll(this.poll.accessCode);
            }
        };

        update();
        this.countdownInterval = setInterval(update, 1000);
    }

    showUnavailable() {
        this.hideAllStates();
        Utils.showElement('unavailableState');
    }

    showWaitingState() {
        this.hideAllStates();
        Utils.showElement('waitingState');
    }

    showVotingState() {
        this.hideAllStates();
        Utils.showElement('votingState');
        this.renderQuestion();
    }

    hideAllStates() {
        Utils.hideElement('loadingState');
        Utils.hideElement('codeEntry');
        Utils.hideElement('countdownState');
        Utils.hideElement('unavailableState');
        Utils.hideElement('waitingState');
        Utils.hideElement('votingState');
    }

    renderQuestion() {
        if (!this.activeQuestion) return;

        const q = this.activeQuestion;

        // Image
        const imageContainer = document.getElementById('questionImage');
        const imageEl = imageContainer.querySelector('img');
        if (q.imagePath) {
            imageEl.src = q.imagePath;
            Utils.showElement(imageContainer);
        } else {
            Utils.hideElement(imageContainer);
        }

        // Content
        const contentEl = document.getElementById('questionContent');
        contentEl.innerHTML = q.content;
        if (q.useMonospace) {
            contentEl.classList.add('monospace');
        } else {
            contentEl.classList.remove('monospace');
        }

        // Options
        const optionsList = document.getElementById('optionsList');
        optionsList.innerHTML = '';

        if (this.hasVoted) {
            // Show results
            this.renderResults(q.options);
        } else {
            // Show voting options
            const inputType = q.allowMultiple ? 'checkbox' : 'radio';
            q.options.forEach(opt => {
                const item = document.createElement('label');
                item.className = 'option-item';
                item.innerHTML = `
                    <input type="${inputType}" name="option" value="${opt.id}">
                    <span class="option-text">${Utils.escapeHtml(opt.text)}</span>
                `;

                const input = item.querySelector('input');
                input.addEventListener('change', (e) => this.handleOptionSelect(opt.id, e.target.checked));

                optionsList.appendChild(item);
            });
        }

        // Vote button
        const submitBtn = document.getElementById('submitVoteBtn');
        const voteMessage = document.getElementById('voteMessage');

        if (this.hasVoted) {
            Utils.hideElement(submitBtn);
            Utils.showElement(voteMessage);
        } else {
            Utils.showElement(submitBtn);
            Utils.hideElement(voteMessage);
            submitBtn.disabled = this.selectedOptions.size === 0;
        }
    }

    handleOptionSelect(optionId, isSelected) {
        if (!this.activeQuestion.allowMultiple) {
            // Single choice - clear previous selection
            this.selectedOptions.clear();
        }

        if (isSelected) {
            this.selectedOptions.add(optionId);
        } else {
            this.selectedOptions.delete(optionId);
        }

        // Update UI
        document.querySelectorAll('.option-item').forEach(item => {
            const input = item.querySelector('input');
            if (input.checked) {
                item.classList.add('selected');
            } else {
                item.classList.remove('selected');
            }
        });

        // Update submit button
        const submitBtn = document.getElementById('submitVoteBtn');
        submitBtn.disabled = this.selectedOptions.size === 0;
    }

    async handleSubmitVote() {
        if (this.selectedOptions.size === 0 || this.hasVoted) return;

        const submitBtn = document.getElementById('submitVoteBtn');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Submitting...';

        try {
            const result = await API.vote(this.activeQuestion.id, Array.from(this.selectedOptions));

            this.hasVoted = true;
            this.markAsVoted(this.activeQuestion.id);

            // Update to show results
            this.updateResults(result.results);
            this.renderQuestion();
        } catch (error) {
            console.error('Failed to submit vote:', error);
            submitBtn.disabled = false;
            submitBtn.textContent = 'Submit';
            alert('Failed to submit your vote. Please try again.');
        }
    }

    renderResults(options) {
        const optionsList = document.getElementById('optionsList');
        optionsList.innerHTML = '';
        optionsList.classList.remove('options-list');
        optionsList.classList.add('results-list');

        const total = options.reduce((sum, opt) => sum + opt.voteCount, 0);

        options.forEach(opt => {
            const percentage = Utils.calculatePercentage(opt.voteCount, total);
            const item = document.createElement('div');
            item.className = 'result-item';
            item.dataset.optionId = opt.id;
            item.innerHTML = `
                <div class="result-header">
                    <span class="result-text">${Utils.escapeHtml(opt.text)}</span>
                    <span class="result-count">${opt.voteCount} vote${opt.voteCount !== 1 ? 's' : ''}</span>
                </div>
                <div class="result-bar-container">
                    <div class="result-bar" style="width: ${percentage}%">
                        <span class="result-percentage">${percentage}%</span>
                    </div>
                </div>
            `;
            optionsList.appendChild(item);
        });
    }

    updateResults(results) {
        // results is { optionId: voteCount }
        const total = Object.values(results).reduce((sum, count) => sum + count, 0);

        Object.entries(results).forEach(([optionId, voteCount]) => {
            const item = document.querySelector(`.result-item[data-option-id="${optionId}"]`);
            if (item) {
                const percentage = Utils.calculatePercentage(voteCount, total);
                item.querySelector('.result-count').textContent = `${voteCount} vote${voteCount !== 1 ? 's' : ''}`;
                item.querySelector('.result-bar').style.width = `${percentage}%`;
                item.querySelector('.result-percentage').textContent = `${percentage}%`;
            }
        });
    }

    // Track voted questions in session storage
    checkIfVoted(questionId) {
        const voted = JSON.parse(sessionStorage.getItem('votedQuestions') || '[]');
        return voted.includes(questionId);
    }

    markAsVoted(questionId) {
        const voted = JSON.parse(sessionStorage.getItem('votedQuestions') || '[]');
        if (!voted.includes(questionId)) {
            voted.push(questionId);
            sessionStorage.setItem('votedQuestions', JSON.stringify(voted));
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    new RespondentApp();
});
