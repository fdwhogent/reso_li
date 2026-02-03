// Shared utilities for reso_li

// Theme management
const ThemeManager = {
    init() {
        const saved = localStorage.getItem('theme');
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        const theme = saved || (prefersDark ? 'dark' : 'light');
        this.setTheme(theme);

        // Listen for system theme changes
        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
            if (!localStorage.getItem('theme')) {
                this.setTheme(e.matches ? 'dark' : 'light');
            }
        });
    },

    setTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        this.updateToggleIcons(theme);
    },

    toggle() {
        const current = document.documentElement.getAttribute('data-theme') || 'light';
        const next = current === 'dark' ? 'light' : 'dark';
        localStorage.setItem('theme', next);
        this.setTheme(next);
    },

    updateToggleIcons(theme) {
        const sunIcon = document.querySelector('.sun-icon');
        const moonIcon = document.querySelector('.moon-icon');
        if (sunIcon && moonIcon) {
            if (theme === 'dark') {
                sunIcon.classList.add('hidden');
                moonIcon.classList.remove('hidden');
            } else {
                sunIcon.classList.remove('hidden');
                moonIcon.classList.add('hidden');
            }
        }
    }
};

// API utilities
const API = {
    baseUrl: '/api',

    async request(endpoint, options = {}) {
        const url = `${this.baseUrl}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        if (options.body && typeof options.body === 'object') {
            config.body = JSON.stringify(options.body);
        }

        const response = await fetch(url, config);
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            throw new Error(data.error || 'An error occurred');
        }

        return data;
    },

    // Polls
    async getPoll(code) {
        return this.request(`/polls/${code}`);
    },

    async getPublicPoll() {
        return this.request('/polls/public');
    },

    async createPoll(accessCode, password, availableFrom, availableUntil) {
        return this.request('/polls', {
            method: 'POST',
            body: { accessCode, password, availableFrom, availableUntil }
        });
    },

    async authenticatePoll(code, password) {
        return this.request(`/polls/${code}/auth`, {
            method: 'POST',
            body: { password }
        });
    },

    async addQuestion(code, password, data) {
        return this.request(`/polls/${code}/questions`, {
            method: 'POST',
            headers: { 'X-Poll-Password': password },
            body: data
        });
    },

    async reorderQuestions(code, password, questionIds) {
        return this.request(`/polls/${code}/questions/reorder`, {
            method: 'PUT',
            headers: { 'X-Poll-Password': password },
            body: { questionIds }
        });
    },

    // Questions
    async getQuestion(id) {
        return this.request(`/questions/${id}`);
    },

    async activateQuestion(id, password) {
        return this.request(`/questions/${id}/activate`, {
            method: 'POST',
            headers: { 'X-Poll-Password': password }
        });
    },

    async deactivateQuestion(id, password) {
        return this.request(`/questions/${id}/deactivate`, {
            method: 'POST',
            headers: { 'X-Poll-Password': password }
        });
    },

    async resetQuestion(id, password) {
        return this.request(`/questions/${id}/reset`, {
            method: 'POST',
            headers: { 'X-Poll-Password': password }
        });
    },

    async deleteQuestion(id, password) {
        return this.request(`/questions/${id}`, {
            method: 'DELETE',
            headers: { 'X-Poll-Password': password }
        });
    },

    async vote(questionId, optionIds) {
        return this.request(`/questions/${questionId}/vote`, {
            method: 'POST',
            body: { optionIds }
        });
    },

    async getResults(questionId) {
        return this.request(`/questions/${questionId}/results`);
    },

    // Admin
    async adminAuth(password) {
        return this.request('/admin/auth', {
            method: 'POST',
            body: { password }
        });
    },

    async getAllPolls(adminPassword) {
        return this.request('/admin/polls', {
            headers: { 'X-Admin-Password': adminPassword }
        });
    },

    async setPublicPoll(adminPassword, accessCode, timeoutMinutes) {
        return this.request('/admin/public', {
            method: 'POST',
            headers: { 'X-Admin-Password': adminPassword },
            body: { accessCode, timeoutMinutes }
        });
    },

    async uploadImage(questionId, adminPassword, file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.baseUrl}/admin/questions/${questionId}/image`, {
            method: 'POST',
            headers: { 'X-Admin-Password': adminPassword },
            body: formData
        });

        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
            throw new Error(data.error || 'Upload failed');
        }
        return data;
    }
};

// SignalR connection
class PollConnection {
    constructor() {
        this.connection = null;
        this.currentPollCode = null;
        this.handlers = {};
    }

    async connect(pollCode) {
        if (this.connection) {
            await this.disconnect();
        }

        this.connection = new signalR.HubConnectionBuilder()
            .withUrl('/pollhub')
            .withAutomaticReconnect()
            .build();

        this.connection.on('VoteUpdate', (questionId, results) => {
            if (this.handlers.onVoteUpdate) {
                this.handlers.onVoteUpdate(questionId, results);
            }
        });

        this.connection.on('QuestionActivated', (questionId) => {
            if (this.handlers.onQuestionActivated) {
                this.handlers.onQuestionActivated(questionId);
            }
        });

        this.connection.on('QuestionDeactivated', () => {
            if (this.handlers.onQuestionDeactivated) {
                this.handlers.onQuestionDeactivated();
            }
        });

        await this.connection.start();
        await this.connection.invoke('JoinPoll', pollCode);
        this.currentPollCode = pollCode;
    }

    async disconnect() {
        if (this.connection && this.currentPollCode) {
            try {
                await this.connection.invoke('LeavePoll', this.currentPollCode);
            } catch (e) {
                // Ignore errors during disconnect
            }
            await this.connection.stop();
            this.connection = null;
            this.currentPollCode = null;
        }
    }

    on(event, handler) {
        this.handlers[event] = handler;
    }
}

// Utility functions
const Utils = {
    formatDate(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        return date.toLocaleString();
    },

    formatCountdown(targetDate) {
        const now = new Date();
        const target = new Date(targetDate);
        const diff = target - now;

        if (diff <= 0) return '00:00:00';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    getQueryParam(name) {
        const params = new URLSearchParams(window.location.search);
        return params.get(name);
    },

    showElement(el) {
        if (typeof el === 'string') el = document.getElementById(el);
        if (el) el.classList.remove('hidden');
    },

    hideElement(el) {
        if (typeof el === 'string') el = document.getElementById(el);
        if (el) el.classList.add('hidden');
    },

    calculatePercentage(count, total) {
        if (total === 0) return 0;
        return Math.round((count / total) * 100);
    }
};

// Initialize theme on all pages
document.addEventListener('DOMContentLoaded', () => {
    ThemeManager.init();

    // Setup theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', () => ThemeManager.toggle());
    }
});
