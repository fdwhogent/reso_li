// Rich text editor for reso_li

class RichTextEditor {
    constructor(toolbarId, contentId) {
        this.toolbar = document.getElementById(toolbarId);
        this.content = document.getElementById(contentId);
        this.isMonospace = false;

        if (this.toolbar && this.content) {
            this.init();
        }
    }

    init() {
        // Toolbar button handlers
        this.toolbar.querySelectorAll('button[data-command]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const command = btn.dataset.command;
                this.execCommand(command);
                btn.classList.toggle('active', document.queryCommandState(command));
            });
        });

        // Monospace toggle
        const monospaceBtn = document.getElementById('monospaceBtn');
        if (monospaceBtn) {
            monospaceBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.toggleMonospace();
                monospaceBtn.classList.toggle('active', this.isMonospace);
            });
        }

        // Color picker
        const colorPickerBtn = document.getElementById('colorPickerBtn');
        const colorDropdown = document.getElementById('colorDropdown');

        if (colorPickerBtn && colorDropdown) {
            colorPickerBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                colorDropdown.classList.toggle('show');
            });

            colorDropdown.querySelectorAll('.color-swatch').forEach(swatch => {
                swatch.addEventListener('click', (e) => {
                    e.preventDefault();
                    const color = swatch.dataset.color;
                    this.execCommand('foreColor', color);
                    colorDropdown.classList.remove('show');
                });
            });

            // Close dropdown when clicking outside
            document.addEventListener('click', () => {
                colorDropdown.classList.remove('show');
            });
        }

        // Update toolbar state on selection change
        this.content.addEventListener('keyup', () => this.updateToolbarState());
        this.content.addEventListener('mouseup', () => this.updateToolbarState());

        // Placeholder
        this.content.addEventListener('focus', () => {
            if (this.content.textContent === this.content.getAttribute('placeholder')) {
                this.content.textContent = '';
                this.content.classList.remove('placeholder');
            }
        });

        this.content.addEventListener('blur', () => {
            if (!this.content.textContent.trim()) {
                this.content.textContent = this.content.getAttribute('placeholder') || '';
                this.content.classList.add('placeholder');
            }
        });
    }

    execCommand(command, value = null) {
        this.content.focus();
        document.execCommand(command, false, value);
    }

    toggleMonospace() {
        this.isMonospace = !this.isMonospace;
        if (this.isMonospace) {
            this.content.classList.add('monospace');
        } else {
            this.content.classList.remove('monospace');
        }
    }

    updateToolbarState() {
        this.toolbar.querySelectorAll('button[data-command]').forEach(btn => {
            const command = btn.dataset.command;
            btn.classList.toggle('active', document.queryCommandState(command));
        });
    }

    getContent() {
        const placeholder = this.content.getAttribute('placeholder');
        if (this.content.textContent === placeholder) {
            return '';
        }
        return this.content.innerHTML;
    }

    setContent(html) {
        this.content.innerHTML = html;
    }

    clear() {
        this.content.innerHTML = '';
        this.isMonospace = false;
        this.content.classList.remove('monospace');
        const monospaceBtn = document.getElementById('monospaceBtn');
        if (monospaceBtn) {
            monospaceBtn.classList.remove('active');
        }
    }

    isUsingMonospace() {
        return this.isMonospace;
    }

    setMonospace(value) {
        this.isMonospace = value;
        if (value) {
            this.content.classList.add('monospace');
        } else {
            this.content.classList.remove('monospace');
        }
        const monospaceBtn = document.getElementById('monospaceBtn');
        if (monospaceBtn) {
            monospaceBtn.classList.toggle('active', value);
        }
    }
}
