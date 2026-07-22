const animeRef = window.anime

if (animeRef) {
  animeRef({
    targets: '#hero > *',
    opacity: [0, 1],
    translateY: [12, 0],
    duration: 320,
    easing: 'easeOutQuad',
    delay: animeRef.stagger(40),
  })

  const revealCards = (entries, observer) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        return
      }

      animeRef({
        targets: entry.target.querySelectorAll('.feature-card'),
        opacity: [0, 1],
        translateY: [10, 0],
        duration: 280,
        easing: 'easeOutQuad',
        delay: animeRef.stagger(50),
      })

      observer.unobserve(entry.target)
    })
  }

  const observer = new IntersectionObserver(revealCards, { threshold: 0.2 })

  document.querySelectorAll('.how-it-works, .pricing').forEach((section) => observer.observe(section))

  document.querySelectorAll('.cta').forEach((element) => {
    element.addEventListener('mouseenter', () => {
      animeRef({
        targets: element,
        scale: 1.02,
        duration: 180,
        easing: 'easeOutQuad',
      })
    })

    element.addEventListener('mouseleave', () => {
      animeRef({
        targets: element,
        scale: 1,
        duration: 180,
        easing: 'easeOutQuad',
      })
    })
  })
}

const form = document.getElementById('waitlist-form')
const message = document.getElementById('waitlist-message')

form?.addEventListener('submit', (event) => {
  event.preventDefault()

  const emailInput = document.getElementById('email')

  if (!(emailInput instanceof HTMLInputElement)) {
    return
  }

  message.textContent = `Obrigado! ${emailInput.value} foi adicionado à waitlist.`
  form.reset()
})

const counter = document.querySelector('.counter')

if (counter && animeRef) {
  animeRef({
    targets: { value: 0 },
    value: Number(counter.getAttribute('data-target') ?? '0'),
    round: 1,
    easing: 'easeOutCubic',
    duration: 360,
    update(animation) {
      counter.textContent = `${animation.animations[0].currentValue}€`
    },
  })
}
