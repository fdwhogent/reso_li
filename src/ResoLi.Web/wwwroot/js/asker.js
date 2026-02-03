// Asker dashboard logic for reso_li

class AskerApp {
    constructor() {
        this.poll = null;
        this.password = null;
        this.pollCode = null;
        this.activeQuestion = null;
        this.selectedQuestion = null;
        this.connection = new PollConnection();

        this.init();
    }

    async init() {
        this.pollCode = Utils.getQueryParam('poll');
        if (!this.pollCode) {
            alert('No poll code specified');
            window.location.href = '/ask.html';
            return;
        }

        this.bindEvents();
        this.setupSignalR();

        // Check if we have saved password
        const savedPassword = sessionStorage.getItem(`poll_${this.pollCode}_password`);
        if (savedPassword) {
            this.password = savedPassword;
            await this.loadPoll();
        }
    }

    bindEvents() {
        // Login
        document.getElementById('loginBtn').addEventListener('click', () => this.handleLogin());
        document.getElementById('loginPassword').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.handleLogin();
        });

        // Navigation
        document.getElementById('overviewBtn').addEventListener('click', () => this.showOverview());
        document.getElementById('nextQuestionBtn').addEventListener('click', () => this.activateNextQuestion());
        document.getElementById('backToOverviewBtn').addEventListener('click', () => this.showOverview());

        // Add question links
        document.getElementById('addQuestionLink').addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = `/ask.html?poll=${this.pollCode}`;
        });
        document.getElementById('addFirstQuestion').addEventListener('click', (e) => {
            e.preventDefault();
            window.location.href = `/ask.html?poll=${this.pollCode}`;
        });

        // Reset votes
        document.getElementById('resetVotesBtn').addEventListener('click', () => this.showResetModal());
        document.getElementById('cancelResetBtn').addEventListener('click', () => this.hideResetModal());
        document.getElementById('confirmResetBtn').addEventListener('click', () => this.handleResetVotes());

        // Delete question
        document.getElementById('cancelDeleteBtn').addEventListener('click', () => this.hideDeleteModal());
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => this.handleDeleteQuestion());
    }

    setupSignalR() {
        this.connection.on('onVoteUpdate', (questionId, results) => {
            if (this.activeQuestion?.id === questionId) {
                this.updateActiveResults(results);
            }
        });

        this.connection.on('onQuestionActivated', async (questionId) => {
            await this.loadPoll();
            const question = this.poll.questions.find(q => q.id === questionId);
            if (question) {
                this.activeQuestion = question;
                this.showActiveQuestion();
            }
        });

        this.connection.on('onQuestionDeactivated', () => {
            this.activeQuestion = null;
            this.showOverview();
        });
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
            await API.authenticatePoll(this.pollCode, password);
            this.password = password;
            sessionStorage.setItem(`poll_${this.pollCode}_password`, password);

            document.getElementById('loginModal').classList.remove('show');
            await this.loadPoll();
        } catch (error) {
            errorEl.textContent = error.message || 'Invalid password';
            Utils.showElement(errorEl);
        }
    }

    async loadPoll() {
        Utils.showElement('loadingState');

        try {
            this.poll = await API.getPoll(this.pollCode);
            await this.connection.connect(this.pollCode);

            document.getElementById('pollCodeDisplay').textContent = this.poll.accessCode;
            document.getElementById('addQuestionLink').href = `/ask.html?poll=${this.pollCode}`;
            document.getElementById('addFirstQuestion').href = `/ask.html?poll=${this.pollCode}`;

            Utils.showElement('navBar');
            Utils.hideElement('loadingState');

            // Check for active question
            const activeQ = this.poll.questions.find(q => q.isActive);
            if (activeQ) {
                this.activeQuestion = activeQ;
                this.showActiveQuestion();
            } else {
                this.showOverview();
            }
        } catch (error) {
            console.error('Failed to load poll:', error);
            Utils.hideElement('loadingState');
            alert('Failed to load poll: ' + error.message);
        }
    }

    showOverview() {
        this.hideAllStates();
        Utils.showElement('overviewState');
        document.getElementById('currentView').textContent = 'Overview';
        Utils.hideElement('nextQuestionBtn');
        Utils.showElement('overviewBtn');
        document.getElementById('overviewBtn').classList.add('hidden');

        this.renderQuestionsOverview();
    }

    showActiveQuestion() {
        this.hideAllStates();
        Utils.showElement('activeQuestionState');
        document.getElementById('currentView').textContent = 'Live';
        Utils.showElement('overviewBtn');
        Utils.showElement('nextQuestionBtn');
        document.getElementById('overviewBtn').classList.remove('hidden');

        this.renderActiveQuestion();
    }

    showHistoricalView(question) {
        this.hideAllStates();
        Utils.showElement('historicalState');
        document.getElementById('currentView').textContent = 'Results';
        Utils.showElement('overviewBtn');
        Utils.hideElement('nextQuestionBtn');
        document.getElementById('overviewBtn').classList.remove('hidden');

        this.selectedQuestion = question;
        this.renderHistoricalQuestion(question);
    }

    hideAllStates() {
        Utils.hideElement('loadingState');
        Utils.hideElement('overviewState');
        Utils.hideElement('activeQuestionState');
        Utils.hideElement('historicalState');
    }

    renderQuestionsOverview() {
        const container = document.getElementById('questionsOverview');
        const noQuestions = document.getElementById('noQuestions');

        if (!this.poll.questions || this.poll.questions.length === 0) {
            Utils.showElement(noQuestions);
            container.innerHTML = '';
            return;
        }

        Utils.hideElement(noQuestions);
        container.innerHTML = '';

        this.poll.questions.forEach((q, index) => {
            const totalVotes = q.options.reduce((sum, opt) => sum + opt.voteCount, 0);
            const isActive = q.isActive;

            const item = document.createElement('div');
            item.className = `question-list-item ${isActive ? 'active' : ''}`;
            item.innerHTML = `
                <span class="drag-handle" title="Drag to reorder">&#9776;</span>
                <span class="question-number">${index + 1}</span>
                <div class="question-info">
                    <div class="question-title">${Utils.escapeHtml(q.title || 'Untitled question')}</div>
                    <div class="question-meta">
                        ${q.options.length} options -
                        ${q.allowMultiple ? 'Multiple choice' : 'Single choice'} -
                        ${totalVotes} votes
                        ${isActive ? ' - <strong>LIVE</strong>' : ''}
                    </div>
                </div>
                <div class="question-actions">
                    ${isActive
                        ? `<button class="btn btn-secondary btn-sm deactivate-btn" data-id="${q.id}">Stop</button>`
                        : `<button class="btn btn-primary btn-sm activate-btn" data-id="${q.id}">Activate</button>`
                    }
                    <button class="btn btn-secondary btn-sm view-btn" data-id="${q.id}">View</button>
                    <button class="btn btn-danger btn-sm delete-btn" data-id="${q.id}">Delete</button>
                </div>
            `;

            // Click on item to view
            item.querySelector('.question-info').addEventListener('click', () => {
                const question = this.poll.questions.find(qu => qu.id === q.id);
                if (question.isActive) {
                    this.showActiveQuestion();
                } else {
                    this.showHistoricalView(question);
                }
            });

            // Activate button
            const activateBtn = item.querySelector('.activate-btn');
            if (activateBtn) {
                activateBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.activateQuestion(q.id);
                });
            }

            // Deactivate button
            const deactivateBtn = item.querySelector('.deactivate-btn');
            if (deactivateBtn) {
                deactivateBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.deactivateQuestion(q.id);
                });
            }

            // View button
            item.querySelector('.view-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                const question = this.poll.questions.find(qu => qu.id === q.id);
                if (question.isActive) {
                    this.showActiveQuestion();
                } else {
                    this.showHistoricalView(question);
                }
            });

            // Delete button
            item.querySelector('.delete-btn').addEventListener('click', (e) => {
                e.stopPropagation();
                this.selectedQuestion = q;
                this.showDeleteModal();
            });

            container.appendChild(item);
        });

        // Setup drag and drop for reordering
        this.setupDragAndDrop(container);
    }

    setupDragAndDrop(container) {
        let draggedItem = null;

        container.querySelectorAll('.question-list-item').forEach((item, index) => {
            item.draggable = true;
            item.dataset.index = index;

            item.addEventListener('dragstart', (e) => {
                draggedItem = item;
                item.style.opacity = '0.5';
            });

            item.addEventListener('dragend', () => {
                item.style.opacity = '1';
                draggedItem = null;
            });

            item.addEventListener('dragover', (e) => {
                e.preventDefault();
            });

            item.addEventListener('drop', async (e) => {
                e.preventDefault();
                if (draggedItem && draggedItem !== item) {
                    const fromIndex = parseInt(draggedItem.dataset.index);
                    const toIndex = parseInt(item.dataset.index);

                    // Reorder in local array
                    const questions = [...this.poll.questions];
                    const [moved] = questions.splice(fromIndex, 1);
                    questions.splice(toIndex, 0, moved);

                    // Update order indexes
                    const questionIds = questions.map(q => q.id);

                    try {
                        await API.reorderQuestions(this.pollCode, this.password, questionIds);
                        this.poll.questions = questions;
                        this.renderQuestionsOverview();
                    } catch (error) {
                        console.error('Failed to reorder:', error);
                        this.renderQuestionsOverview();
                    }
                }
            });
        });
    }

    renderActiveQuestion() {
        if (!this.activeQuestion) return;

        const q = this.activeQuestion;

        // Image
        const imageContainer = document.getElementById('activeQuestionImage');
        const imageEl = imageContainer.querySelector('img');
        if (q.imagePath) {
            imageEl.src = q.imagePath;
            Utils.showElement(imageContainer);
        } else {
            Utils.hideElement(imageContainer);
        }

        // Content
        const contentEl = document.getElementById('activeQuestionContent');
        contentEl.innerHTML = q.content;
        if (q.useMonospace) {
            contentEl.classList.add('monospace');
        } else {
            contentEl.classList.remove('monospace');
        }

        // Results
        this.renderResults('activeQuestionResults', q.options);

        // Total votes
        const total = q.options.reduce((sum, opt) => sum + opt.voteCount, 0);
        document.getElementById('totalVotes').textContent = total;
    }

    renderHistoricalQuestion(question) {
        document.getElementById('historicalTitle').textContent = question.title || 'Question results';

        const contentEl = document.getElementById('historicalContent');
        contentEl.innerHTML = question.content;
        if (question.useMonospace) {
            contentEl.classList.add('monospace');
        } else {
            contentEl.classList.remove('monospace');
        }

        this.renderResults('historicalResults', question.options);

        const total = question.options.reduce((sum, opt) => sum + opt.voteCount, 0);
        document.getElementById('historicalTotalVotes').textContent = total;
    }

    renderResults(containerId, options) {
        const container = document.getElementById(containerId);
        container.innerHTML = '';

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
                    <div class="result-bar" style="width: ${Math.max(percentage, 2)}%">
                        <span class="result-percentage">${percentage}%</span>
                    </div>
                </div>
            `;
            container.appendChild(item);
        });
    }

    updateActiveResults(results) {
        const total = Object.values(results).reduce((sum, count) => sum + count, 0);

        Object.entries(results).forEach(([optionId, voteCount]) => {
            const item = document.querySelector(`#activeQuestionResults .result-item[data-option-id="${optionId}"]`);
            if (item) {
                const percentage = Utils.calculatePercentage(voteCount, total);
                item.querySelector('.result-count').textContent = `${voteCount} vote${voteCount !== 1 ? 's' : ''}`;
                item.querySelector('.result-bar').style.width = `${Math.max(percentage, 2)}%`;
                item.querySelector('.result-percentage').textContent = `${percentage}%`;
            }
        });

        document.getElementById('totalVotes').textContent = total;

        // Update in poll data
        if (this.activeQuestion) {
            Object.entries(results).forEach(([optionId, voteCount]) => {
                const opt = this.activeQuestion.options.find(o => o.id === optionId);
                if (opt) opt.voteCount = voteCount;
            });
        }
    }

    async activateQuestion(questionId) {
        try {
            await API.activateQuestion(questionId, this.password);
            await this.loadPoll();
        } catch (error) {
            console.error('Failed to activate question:', error);
            alert('Failed to activate question: ' + error.message);
        }
    }

    async deactivateQuestion(questionId) {
        try {
            await API.deactivateQuestion(questionId, this.password);
            this.activeQuestion = null;
            await this.loadPoll();
        } catch (error) {
            console.error('Failed to deactivate question:', error);
            alert('Failed to deactivate question: ' + error.message);
        }
    }

    async activateNextQuestion() {
        if (!this.activeQuestion || !this.poll.questions) return;

        const currentIndex = this.poll.questions.findIndex(q => q.id === this.activeQuestion.id);
        const nextIndex = currentIndex + 1;

        if (nextIndex < this.poll.questions.length) {
            const nextQuestion = this.poll.questions[nextIndex];
            await this.activateQuestion(nextQuestion.id);
        } else {
            // No more questions
            await this.deactivateQuestion(this.activeQuestion.id);
            this.showOverview();
        }
    }

    showResetModal() {
        document.getElementById('resetModal').classList.add('show');
    }

    hideResetModal() {
        document.getElementById('resetModal').classList.remove('show');
    }

    async handleResetVotes() {
        if (!this.selectedQuestion) return;

        try {
            await API.resetQuestion(this.selectedQuestion.id, this.password);
            this.hideResetModal();

            // Reload and show
            await this.loadPoll();
            const updatedQuestion = this.poll.questions.find(q => q.id === this.selectedQuestion.id);
            if (updatedQuestion) {
                this.showHistoricalView(updatedQuestion);
            }
        } catch (error) {
            console.error('Failed to reset votes:', error);
            alert('Failed to reset votes: ' + error.message);
        }
    }

    showDeleteModal() {
        document.getElementById('deleteModal').classList.add('show');
    }

    hideDeleteModal() {
        document.getElementById('deleteModal').classList.remove('show');
    }

    async handleDeleteQuestion() {
        if (!this.selectedQuestion) return;

        try {
            await API.deleteQuestion(this.selectedQuestion.id, this.password);
            this.hideDeleteModal();
            await this.loadPoll();
            this.showOverview();
        } catch (error) {
            console.error('Failed to delete question:', error);
            alert('Failed to delete question: ' + error.message);
        }
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    new AskerApp();
});
