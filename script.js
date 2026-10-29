// HansenOS — a tiny System 7–style window manager
document.addEventListener('DOMContentLoaded', function() {
    const desktop = document.getElementById('desktop');
    const windowLayer = document.getElementById('windows');
    const mobileQuery = window.matchMedia('(max-width: 700px)');
    const coarsePointer = window.matchMedia('(pointer: coarse)');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    const openWindows = new Map(); // app id -> window element
    let zIndex = 10;
    let cascade = 0;
    let trashEmpty = false;

    // ---------- Windows ----------

    function openApp(id, sourceEl) {
        if (openWindows.has(id)) {
            focusWindow(openWindows.get(id));
            return openWindows.get(id);
        }

        const template = document.getElementById('app-' + id);
        if (!template) return null;

        const win = createWindow(id, template.dataset.title, template.content.cloneNode(true), {
            width: Number(template.dataset.w) || 520,
            height: Number(template.dataset.h) || 400,
            status: template.dataset.status
        }, sourceEl);

        if (id === 'trash' && trashEmpty) {
            win.querySelector('.folder').replaceChildren();
            win.querySelector('.window-status span').textContent = '0 items';
        }
        if (id === 'terminal') initTerminal(win);
        return win;
    }

    function openImage(src, name, sourceEl) {
        const id = 'image:' + src;
        if (openWindows.has(id)) {
            focusWindow(openWindows.get(id));
            return;
        }

        const viewer = document.createElement('div');
        viewer.className = 'viewer';
        const img = document.createElement('img');
        img.src = src;
        img.alt = name;
        viewer.appendChild(img);

        createWindow(id, name, viewer, { width: 520, height: 460 }, sourceEl);
    }

    function createWindow(id, title, content, opts, sourceEl) {
        const win = document.createElement('section');
        win.className = 'window';
        win.dataset.app = id;
        win.setAttribute('aria-label', title);

        const titlebar = document.createElement('div');
        titlebar.className = 'titlebar';
        titlebar.innerHTML =
            '<button class="close-box" aria-label="Close"></button>' +
            '<span class="window-title"></span>' +
            '<button class="zoom-box" aria-label="Zoom"></button>';
        titlebar.querySelector('.window-title').textContent = title;
        win.appendChild(titlebar);

        if (opts.status) {
            const status = document.createElement('div');
            status.className = 'window-status';
            status.innerHTML = '<span></span><span>HansenOS</span>';
            status.firstChild.textContent = opts.status;
            win.appendChild(status);
        }

        const body = document.createElement('div');
        body.className = 'window-body';
        body.appendChild(content);
        win.appendChild(body);

        const grow = document.createElement('div');
        grow.className = 'grow-box';
        win.appendChild(grow);

        body.querySelectorAll('.social-row').forEach(row => {
            row.appendChild(document.getElementById('social-links').content.cloneNode(true));
        });

        // Size and cascade within the visible desktop
        const bounds = desktop.getBoundingClientRect();
        const width = Math.min(opts.width, bounds.width - 140);
        const height = Math.min(opts.height, bounds.height - 40);
        const step = (cascade++ % 8) * 26;
        const left = Math.max(8, Math.min(40 + step, bounds.width - width - 120));
        const top = Math.max(8, Math.min(16 + step, bounds.height - height - 8));
        Object.assign(win.style, {
            left: left + 'px',
            top: top + 'px',
            width: width + 'px',
            height: height + 'px'
        });

        windowLayer.appendChild(win);
        openWindows.set(id, win);
        focusWindow(win);
        animateZoomRects(sourceEl, win);

        titlebar.querySelector('.close-box').addEventListener('click', () => closeWindow(win));
        titlebar.querySelector('.zoom-box').addEventListener('click', () => toggleZoom(win));
        titlebar.addEventListener('dblclick', e => {
            if (!e.target.closest('button')) toggleZoom(win);
        });
        win.addEventListener('pointerdown', () => focusWindow(win));
        makeDraggable(win, titlebar);
        makeResizable(win, grow);

        return win;
    }

    function focusWindow(win) {
        windowLayer.querySelectorAll('.window.active').forEach(w => w.classList.remove('active'));
        win.classList.add('active');
        win.style.zIndex = ++zIndex;
    }

    function frontWindow() {
        return windowLayer.querySelector('.window.active');
    }

    function closeWindow(win) {
        if (!win) return;
        openWindows.delete(win.dataset.app);
        win.remove();

        // Hand focus to the next window down the stack
        const next = [...windowLayer.querySelectorAll('.window')]
            .sort((a, b) => b.style.zIndex - a.style.zIndex)[0];
        if (next) focusWindow(next);
    }

    function toggleZoom(win) {
        if (win.dataset.restore) {
            Object.assign(win.style, JSON.parse(win.dataset.restore));
            delete win.dataset.restore;
            return;
        }
        const { left, top, width, height } = win.style;
        win.dataset.restore = JSON.stringify({ left, top, width, height });
        const bounds = desktop.getBoundingClientRect();
        Object.assign(win.style, {
            left: '4px',
            top: '4px',
            width: (bounds.width - 110) + 'px',
            height: (bounds.height - 10) + 'px'
        });
    }

    // Classic "zoom rects": outlines that expand from the icon to the window
    function animateZoomRects(sourceEl, win) {
        if (!sourceEl || reducedMotion.matches || mobileQuery.matches) return;

        const from = sourceEl.getBoundingClientRect();
        const to = win.getBoundingClientRect();
        const steps = 6;

        for (let i = 1; i <= steps; i++) {
            const t = i / steps;
            const rect = document.createElement('div');
            rect.className = 'zoom-rect';
            Object.assign(rect.style, {
                left: from.left + (to.left - from.left) * t + 'px',
                top: from.top + (to.top - from.top) * t + 'px',
                width: from.width + (to.width - from.width) * t + 'px',
                height: from.height + (to.height - from.height) * t + 'px',
                visibility: 'hidden'
            });
            document.body.appendChild(rect);
            setTimeout(() => { rect.style.visibility = 'visible'; }, i * 22);
            setTimeout(() => rect.remove(), i * 22 + 90);
        }
    }

    function makeDraggable(win, handle) {
        handle.addEventListener('pointerdown', e => {
            if (e.button !== 0 || e.target.closest('button') || mobileQuery.matches) return;
            e.preventDefault();

            const startX = e.clientX;
            const startY = e.clientY;
            const startLeft = win.offsetLeft;
            const startTop = win.offsetTop;
            handle.setPointerCapture(e.pointerId);

            function onMove(ev) {
                const bounds = desktop.getBoundingClientRect();
                // Keep at least part of the title bar reachable
                const left = Math.min(Math.max(startLeft + ev.clientX - startX, 60 - win.offsetWidth), bounds.width - 60);
                const top = Math.min(Math.max(startTop + ev.clientY - startY, 0), bounds.height - 24);
                win.style.left = left + 'px';
                win.style.top = top + 'px';
            }

            function onUp() {
                handle.removeEventListener('pointermove', onMove);
                handle.removeEventListener('pointerup', onUp);
                delete win.dataset.restore;
            }

            handle.addEventListener('pointermove', onMove);
            handle.addEventListener('pointerup', onUp);
        });
    }

    function makeResizable(win, grip) {
        grip.addEventListener('pointerdown', e => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            focusWindow(win);

            const startX = e.clientX;
            const startY = e.clientY;
            const startW = win.offsetWidth;
            const startH = win.offsetHeight;
            grip.setPointerCapture(e.pointerId);

            function onMove(ev) {
                win.style.width = Math.max(240, startW + ev.clientX - startX) + 'px';
                win.style.height = Math.max(140, startH + ev.clientY - startY) + 'px';
            }

            function onUp() {
                grip.removeEventListener('pointermove', onMove);
                grip.removeEventListener('pointerup', onUp);
                delete win.dataset.restore;
            }

            grip.addEventListener('pointermove', onMove);
            grip.addEventListener('pointerup', onUp);
        });
    }

    // ---------- Icons ----------

    const desktopIcons = [...document.querySelectorAll('.desktop-icons .icon')];

    function layoutIcons(force) {
        if (mobileQuery.matches) {
            desktopIcons.forEach(icon => icon.removeAttribute('style'));
            return;
        }
        const width = desktop.clientWidth;
        const perColumn = Math.max(1, Math.floor((desktop.clientHeight - 20) / 84));
        desktopIcons.forEach((icon, i) => {
            if (icon.dataset.moved && !force) return;
            if (force) delete icon.dataset.moved;
            const column = Math.floor(i / perColumn);
            icon.style.left = (width - 108 - column * 100) + 'px';
            icon.style.top = (14 + (i % perColumn) * 84) + 'px';
        });
    }

    function selectIcon(icon) {
        document.querySelectorAll('.icon.selected').forEach(i => i.classList.remove('selected'));
        if (icon) icon.classList.add('selected');
    }

    function activateIcon(icon) {
        if (icon.dataset.app) openApp(icon.dataset.app, icon);
        else if (icon.dataset.image) openImage(icon.dataset.image, icon.textContent.trim(), icon);
    }

    // Desktop icons can be dragged around (except on phones)
    desktopIcons.forEach(icon => {
        icon.addEventListener('pointerdown', e => {
            if (e.button !== 0 || mobileQuery.matches) return;

            const startX = e.clientX;
            const startY = e.clientY;
            const startLeft = icon.offsetLeft;
            const startTop = icon.offsetTop;
            let dragging = false;
            icon.setPointerCapture(e.pointerId);

            function onMove(ev) {
                const dx = ev.clientX - startX;
                const dy = ev.clientY - startY;
                if (!dragging && Math.hypot(dx, dy) < 4) return;
                dragging = true;
                icon.classList.add('dragging');
                icon.style.left = Math.min(Math.max(startLeft + dx, 0), desktop.clientWidth - icon.offsetWidth) + 'px';
                icon.style.top = Math.min(Math.max(startTop + dy, 0), desktop.clientHeight - icon.offsetHeight) + 'px';
            }

            function onUp() {
                icon.removeEventListener('pointermove', onMove);
                icon.removeEventListener('pointerup', onUp);
                if (dragging) {
                    icon.dataset.moved = 'true';
                    icon.classList.remove('dragging');
                }
            }

            icon.addEventListener('pointermove', onMove);
            icon.addEventListener('pointerup', onUp);
        });
    });

    // Single click selects, double click opens — or a single tap on touch screens
    document.addEventListener('click', e => {
        const icon = e.target.closest('.icon');
        if (icon) {
            selectIcon(icon);
            if (coarsePointer.matches) activateIcon(icon);
            return;
        }

        const link = e.target.closest('[data-open]');
        if (link) {
            e.preventDefault();
            openApp(link.dataset.open, link);
            return;
        }

        if (e.target === desktop || e.target === windowLayer || e.target.closest('.folder')) {
            selectIcon(null);
        }
    });

    document.addEventListener('dblclick', e => {
        const icon = e.target.closest('.icon');
        if (icon && !coarsePointer.matches) activateIcon(icon);
    });

    document.addEventListener('keydown', e => {
        const icon = e.target.closest && e.target.closest('.icon');
        if (icon && e.key === 'Enter') {
            e.preventDefault();
            activateIcon(icon);
        }
    });

    // ---------- Menu bar ----------

    const menus = [...document.querySelectorAll('.menu')];

    function closeMenus() {
        menus.forEach(m => m.classList.remove('open'));
    }

    menus.forEach(menu => {
        const title = menu.querySelector('.menu-title');
        title.addEventListener('click', e => {
            e.stopPropagation();
            const wasOpen = menu.classList.contains('open');
            closeMenus();
            if (!wasOpen) menu.classList.add('open');
        });
        // Slide between menus once one is open
        title.addEventListener('pointerenter', () => {
            if (menus.some(m => m.classList.contains('open')) && !menu.classList.contains('open')) {
                closeMenus();
                menu.classList.add('open');
            }
        });
    });

    document.querySelector('.menus').addEventListener('click', e => {
        const item = e.target.closest('.menu-items li');
        if (!item || item.classList.contains('disabled') || item.classList.contains('sep')) return;
        closeMenus();
        if (item.dataset.app) openApp(item.dataset.app);
        if (item.dataset.action) runAction(item.dataset.action);
    });

    document.addEventListener('pointerdown', e => {
        if (!e.target.closest('.menu')) closeMenus();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeMenus();
    });

    function runAction(action) {
        switch (action) {
            case 'about-os':
                openApp('about-os');
                break;
            case 'open-selected': {
                const selected = document.querySelector('.icon.selected');
                if (selected) activateIcon(selected);
                break;
            }
            case 'close-window':
                closeWindow(frontWindow());
                break;
            case 'close-all':
                [...openWindows.values()].forEach(closeWindow);
                break;
            case 'clean-up':
                layoutIcons(true);
                break;
            case 'empty-trash':
                emptyTrash();
                break;
            case 'resume-pdf':
                openApp('resume');
                document.body.classList.add('printing-resume');
                window.print();
                document.body.classList.remove('printing-resume');
                break;
            case 'restart':
                document.getElementById('shutdown').hidden = true;
                [...openWindows.values()].forEach(closeWindow);
                boot(true);
                break;
            case 'shutdown':
                [...openWindows.values()].forEach(closeWindow);
                document.getElementById('shutdown').hidden = false;
                break;
        }
    }

    document.querySelector('#shutdown [data-action="restart"]').addEventListener('click', () => runAction('restart'));

    function emptyTrash() {
        trashEmpty = true;
        document.querySelector('#trash-icon use').setAttribute('href', '#i-trash');
        const win = openWindows.get('trash');
        if (win) {
            win.querySelector('.folder').replaceChildren();
            win.querySelector('.window-status span').textContent = '0 items';
        }
    }

    // ---------- Clock ----------

    const clock = document.getElementById('clock');
    function tick() {
        clock.textContent = new Date().toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    tick();
    setInterval(tick, 10000);

    // ---------- Terminal ----------

    const terminalCommands = {
        help: () => [
            'available commands:',
            '  whoami        who is this guy',
            '  ls            list desktop items',
            '  open <name>   open an app (about, resume, projects, cats, contact)',
            '  cat           meet the cats',
            '  contact       ways to reach me',
            '  clear         clear the screen',
            '  exit          close terminal'
        ],
        whoami: () => [
            'Hansen Yang',
            'Software Engineer | UC Berkeley CS \'27',
            'Specializing in AI/ML and Full-Stack Development'
        ],
        ls: () => ['About Me   Resume   Projects/   Cats/   Contact   Terminal   Trash'],
        cat: () => [
            ' /\\_/\\    /\\_/\\',
            '( o.o )  ( -.- )',
            ' > ^ <    > ^ <',
            'Pucca     Baki',
            '(try: open cats)'
        ],
        contact: () => [
            'email     hansenyang@berkeley.edu',
            'linkedin  linkedin.com/in/hansenyangg',
            'github    github.com/HansenYangg',
            'twitter   x.com/hansennlol'
        ],
        sudo: () => ['nice try.'],
        pwd: () => ['/Users/hansen/Desktop']
    };

    function initTerminal(win) {
        const output = win.querySelector('.term-output');
        const form = win.querySelector('.term-line');
        const input = win.querySelector('.term-input');
        const history = [];
        let historyIndex = 0;

        function write(lines) {
            lines.forEach(line => {
                const p = document.createElement('p');
                p.textContent = line;
                output.appendChild(p);
            });
            win.querySelector('.window-body').scrollTop = 1e9;
        }

        write(['HansenOS Terminal — type "help" to get started.', '']);

        form.addEventListener('submit', e => {
            e.preventDefault();
            const raw = input.value.trim();
            input.value = '';
            write(['hansen@berkeley:~$ ' + raw]);
            if (!raw) return;

            history.push(raw);
            historyIndex = history.length;

            const [command, ...args] = raw.split(/\s+/);
            const name = command.toLowerCase();

            if (name === 'clear') {
                output.replaceChildren();
            } else if (name === 'exit') {
                closeWindow(win);
            } else if (name === 'open') {
                const target = (args[0] || '').toLowerCase().replace(/\/$/, '');
                const app = { me: 'about', 'about-me': 'about', trash: 'trash' }[target] || target;
                if (document.getElementById('app-' + app)) {
                    write(['opening ' + app + '...']);
                    openApp(app);
                } else {
                    write(['open: no such app: ' + (args[0] || '(none)')]);
                }
            } else if (Object.hasOwn(terminalCommands, name)) {
                write(terminalCommands[name](args));
            } else {
                write([command + ': command not found. try "help"']);
            }
        });

        input.addEventListener('keydown', e => {
            if (e.key === 'ArrowUp' && historyIndex > 0) {
                input.value = history[--historyIndex];
                e.preventDefault();
            } else if (e.key === 'ArrowDown' && historyIndex < history.length) {
                input.value = history[++historyIndex] || '';
                e.preventDefault();
            }
        });

        win.querySelector('.terminal').addEventListener('click', () => {
            if (!window.getSelection().toString()) input.focus();
        });
        input.focus();
    }

    // ---------- Boot ----------

    const bootScreen = document.getElementById('boot');
    let bootTimers = [];

    function finishBoot() {
        bootTimers.forEach(clearTimeout);
        bootTimers = [];
        bootScreen.hidden = true;
        try { sessionStorage.setItem('hansenos-booted', '1'); } catch (e) {}
        if (!openWindows.has('about')) openApp('about');
    }

    function boot(force) {
        let booted = false;
        try { booted = sessionStorage.getItem('hansenos-booted'); } catch (e) {}
        if ((booted && !force) || reducedMotion.matches) {
            finishBoot();
            return;
        }

        const happy = bootScreen.querySelector('.boot-happy');
        const welcome = bootScreen.querySelector('.boot-welcome');
        const fill = bootScreen.querySelector('.boot-progress-fill');
        const extensions = bootScreen.querySelector('.boot-extensions');

        bootScreen.hidden = false;
        happy.hidden = false;
        welcome.hidden = true;
        fill.style.width = '0';
        extensions.replaceChildren();

        const later = (fn, ms) => bootTimers.push(setTimeout(fn, ms));

        later(() => {
            happy.hidden = true;
            welcome.hidden = false;
        }, 900);

        // Extensions march across the bottom while the bar fills
        ['#i-disk', '#i-folder', '#i-doc', '#i-terminal', '#i-mail', '#i-folder-cat'].forEach((href, i) => {
            later(() => {
                extensions.insertAdjacentHTML('beforeend', '<svg><use href="' + href + '"/></svg>');
                fill.style.width = ((i + 1) / 6) * 100 + '%';
            }, 1100 + i * 220);
        });

        later(finishBoot, 2700);
    }

    bootScreen.addEventListener('click', finishBoot);

    // ---------- Start ----------

    layoutIcons();
    window.addEventListener('resize', () => layoutIcons());
    mobileQuery.addEventListener('change', () => layoutIcons());
    boot(false);
});
