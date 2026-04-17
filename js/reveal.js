document.addEventListener("DOMContentLoaded", () => {
    const style = document.createElement('style');
    style.innerHTML = `
        /* Base hidden state */
        .reveal-element {
            opacity: 0;
            transition: opacity 0.8s cubic-bezier(0.5, 0, 0, 1), transform 0.8s cubic-bezier(0.5, 0, 0, 1);
            will-change: opacity, transform;
        }

        /* Varied Transforms */
        .reveal-up { transform: translateY(30px); }
        .reveal-down { transform: translateY(-30px); }
        .reveal-left { transform: translateX(-30px); }
        .reveal-right { transform: translateX(30px); }
        .reveal-zoom { transform: scale(0.95); }
        .reveal-blur { filter: blur(10px); transform: translateY(10px); transition: filter 0.8s, opacity 0.8s, transform 0.8s; }

        /* Active State */
        .reveal-element.revealed {
            opacity: 1;
            transform: translate(0) scale(1);
            filter: blur(0);
        }

        /* Staggered Delays (up to 10 items) */
        .delay-100 { transition-delay: 100ms; }
        .delay-200 { transition-delay: 200ms; }
        .delay-300 { transition-delay: 300ms; }
        .delay-400 { transition-delay: 400ms; }
        .delay-500 { transition-delay: 500ms; }
    `;
    document.head.appendChild(style);

    const definitions = [
        { selector: 'main section', type: 'reveal-up' },
        { selector: 'aside > div', type: 'reveal-left' },
        { selector: '.product-card', type: 'reveal-up', stagger: true },
        { selector: '.glass-card', type: 'reveal-zoom', stagger: true },
        { selector: 'h1', type: 'reveal-right' },
        { selector: 'h2, h3', type: 'reveal-up' },
        { selector: 'form', type: 'reveal-zoom' },
        { selector: 'tbody tr', type: 'reveal-up', stagger: true },
        { selector: '.grid > div', type: 'reveal-up', stagger: true },
    ];

    const applyReveal = () => {
        definitions.forEach(def => {
            const elements = document.querySelectorAll(def.selector);
            elements.forEach((el, index) => {
                if (el.classList.contains('reveal-element')) return;

                el.classList.add('reveal-element');
                el.classList.add(def.type);

                if (def.stagger) {
                    const delay = (index % 5) * 100;
                    if (delay > 0) el.style.transitionDelay = `${delay}ms`;
                }
            });
        });
    };

    applyReveal();

    document.fonts.ready.then(() => {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        entry.target.classList.add('revealed');
                    }, 100);
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: "0px 0px -50px 0px"
        });

        document.querySelectorAll('.reveal-element').forEach(el => observer.observe(el));
    });
});
