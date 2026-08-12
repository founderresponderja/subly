import './styles.css';

const waitlistForm = document.querySelector('#waitlist-form');
const waitlistFeedback = document.querySelector('#waitlist-feedback');

if (waitlistForm && waitlistFeedback) {
  // TODO: ligar a um serviço de formulários (ex. Formspree) antes de
  // publicar. Este é o único ponto de rede permitido no projeto — ver
  // regra de arquitetura número um em .github/copilot-instructions.md.
  waitlistForm.addEventListener('submit', (event) => {
    event.preventDefault();
    waitlistFeedback.textContent = 'Em breve';
  });
}
