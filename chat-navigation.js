export function mountChatNavigation() {
    const newChat = document.createElement('div');
    newChat.id = 'seeker-new-chat';
    newChat.className = 'fa-solid fa-comment interactable'; // drawn as message-square-plus: chat-navigation.css
    newChat.setAttribute('role', 'button');
    newChat.setAttribute('tabindex', '0');
    newChat.setAttribute('title', 'New chat');
    const start = () => document.getElementById('option_start_new_chat')?.click();
    newChat.addEventListener('click', start);
    newChat.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            start();
        }
    });
    document.body.append(newChat);

    const home = document.createElement('button');
    home.type = 'button';
    home.id = 'seeker-home';
    home.className = 'fa-solid fa-house';
    home.title = 'Home';
    home.setAttribute('aria-label', 'Home');
    home.addEventListener('click', () => document.getElementById('option_close_chat')?.click());
    document.getElementById('sheld')?.append(home);
}
