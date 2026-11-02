export function mountChatResize(spine) {
    const { eventSource, eventTypes, extensionSettings, powerUserSettings, saveSettingsDebounced } = SillyTavern.getContext();
    const root = document.documentElement;
    const desktop = window.matchMedia('(min-width: 1001px)');
    const slider = document.getElementById('chat_width_slider');
    const counter = document.getElementById('chat_width_slider_counter');
    const settings = extensionSettings.seeker ??= {};
    let ready = false;
    let drag = null;
    let frame = 0;
    let pendingWidth = 0;

    spine.tabIndex = 0;
    spine.setAttribute('role', 'separator');
    spine.setAttribute('aria-label', 'Chat width');
    spine.setAttribute('aria-orientation', 'vertical');
    spine.setAttribute('aria-controls', 'sheld');
    spine.title = 'Chat width';

    const limits = () => ({
        min: Math.max(360, window.innerWidth * Number(slider.min) / 100),
        max: window.innerWidth - 320,
    });
    const width = () => document.getElementById('sheld').getBoundingClientRect().width;
    const updateAria = () => {
        if (!ready || !desktop.matches) return;
        const { min, max } = limits();
        spine.setAttribute('aria-valuemin', String(Math.round(min)));
        spine.setAttribute('aria-valuemax', String(Math.round(max)));
        spine.setAttribute('aria-valuenow', String(Math.round(width())));
        spine.setAttribute('aria-valuetext', `${Math.round(width())} pixels`);
    };
    const applyWidth = pixels => {
        const { min, max } = limits();
        slider.value = (Math.min(max, Math.max(min, pixels)) / window.innerWidth * 100).toFixed(1);
        $(slider).trigger('input', { forced: true });
        updateAria();
    };
    const setup = () => {
        if (!ready || !desktop.matches) return;
        slider.step = '0.1';
        counter.step = '0.1';
        slider.value = String(powerUserSettings.chat_width);
        counter.value = slider.value;
        if (!settings.chatWidthLinked) {
            const currentWidth = width();
            settings.chatWidthLinked = true;
            applyWidth(currentWidth);
            saveSettingsDebounced();
        }
        root.style.setProperty('--seeker-chat-width', 'clamp(360px, var(--sheldWidth), calc(100vw - 320px))');
        updateAria();
    };
    eventSource.on(eventTypes.APP_READY, () => {
        ready = true;
        setup();
    });
    desktop.addEventListener('change', setup);
    window.addEventListener('resize', updateAria);
    slider.addEventListener('input', updateAria);

    const flush = () => {
        if (frame) cancelAnimationFrame(frame);
        frame = 0;
        applyWidth(pendingWidth);
    };
    spine.addEventListener('pointerdown', event => {
        if (!ready || !desktop.matches || event.button !== 0) return;
        event.preventDefault();
        drag = { id: event.pointerId, x: event.clientX, width: width() };
        pendingWidth = drag.width;
        spine.setPointerCapture(event.pointerId);
        spine.focus({ preventScroll: true });
        document.body.classList.add('seeker-resizing-chat');
    });
    spine.addEventListener('pointermove', event => {
        if (!drag || event.pointerId !== drag.id) return;
        pendingWidth = drag.width + drag.x - event.clientX;
        frame ||= requestAnimationFrame(() => {
            frame = 0;
            applyWidth(pendingWidth);
        });
    });
    const finish = event => {
        if (!drag || event.pointerId !== drag.id) return;
        if (event.type === 'pointercancel') pendingWidth = drag.width;
        flush();
        drag = null;
        document.body.classList.remove('seeker-resizing-chat');
    };
    spine.addEventListener('pointerup', finish);
    spine.addEventListener('pointercancel', finish);
    spine.addEventListener('lostpointercapture', event => {
        if (drag) finish(event);
    });
    spine.addEventListener('keydown', event => {
        if (!ready || !desktop.matches) return;
        const { min, max } = limits();
        const target = {
            ArrowLeft: width() + 16,
            ArrowRight: width() - 16,
            Home: min,
            End: max,
        }[event.key];
        if (target === undefined) return;
        event.preventDefault();
        event.stopPropagation();
        applyWidth(target);
    });
}
