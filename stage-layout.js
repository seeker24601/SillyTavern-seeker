import { mountChatResize } from './chat-resize.js';

export function mountStageLayout() {
    const { eventSource, eventTypes } = SillyTavern.getContext();
    const stageName = document.createElement('div');
    stageName.id = 'seeker-stage-name';
    stageName.setAttribute('aria-hidden', 'true'); // the name is in the chat already
    // The spine: a hairline beside the name, carrying the card's creator and version.
    const spine = document.createElement('div');
    spine.id = 'seeker-stage-spine';
    mountChatResize(spine);
    const spineText = document.createElement('span');
    spineText.setAttribute('aria-hidden', 'true');
    spine.append(spineText);
    document.body.append(stageName, spine);
    const updateStageName = () => {
        const context = SillyTavern.getContext();
        const solo = !context.groupId && context.characterId !== undefined;
        stageName.textContent = solo ? context.name2 ?? '' : '';
        const card = solo ? context.characters[context.characterId]?.data : undefined;
        const version = card?.character_version?.trim();
        spineText.textContent = [card?.creator?.trim(), version && `v${version.replace(/^v/i, '')}`].filter(Boolean).join(' · ');
        // style.css sizes the name from the screen height and this length, so long names
        // shrink to fit in one column.
        stageName.style.setProperty('--seeker-stage-name-length', String(Math.max(stageName.textContent.length, 1)));
    };
    // Parallax: the name starts centred and rises at a third of the chat's scroll speed,
    // stopping when it reaches the top margin, so a long chat shows it pinned at the top.
    const chat = document.getElementById('chat');
    const PARALLAX = 0.35;
    const TOP_MARGIN = 32;
    let parallaxFrame = 0;
    const updateParallax = () => {
        parallaxFrame = 0;
        if (!chat || !stageName.textContent || getComputedStyle(stageName).display === 'none') return;
        // Where the name's text starts with no shift: centred in the screen's height.
        const range = document.createRange();
        range.selectNodeContents(stageName);
        const restingTop = range.getBoundingClientRect().top + Number(stageName.style.getPropertyValue('--seeker-stage-name-shift').replace('px', '') || 0);
        const travel = Math.max(restingTop - TOP_MARGIN, 0);
        const shift = Math.min(chat.scrollTop * PARALLAX, travel);
        stageName.style.setProperty('--seeker-stage-name-shift', `${shift.toFixed(1)}px`);
    };
    const queueParallax = () => { parallaxFrame ||= requestAnimationFrame(updateParallax); };
    chat?.addEventListener('scroll', queueParallax, { passive: true });
    window.addEventListener('resize', queueParallax);

    for (const event of [eventTypes.CHAT_CHANGED, eventTypes.CHARACTER_EDITED, eventTypes.CHARACTER_RENAMED, eventTypes.APP_READY]) {
        if (event) eventSource?.on(event, () => { updateStageName(); queueParallax(); });
    }
    // New messages lengthen the chat and SillyTavern scrolls to them.
    for (const event of [eventTypes.MESSAGE_RECEIVED, eventTypes.MESSAGE_SENT, eventTypes.MORE_MESSAGES_LOADED]) {
        if (event) eventSource?.on(event, queueParallax);
    }
    updateStageName();
}
