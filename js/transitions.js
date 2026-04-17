document.addEventListener("DOMContentLoaded", () => {
    
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const revealElements = document.querySelectorAll('.reveal, .reveal-zoom, .reveal-grid');
    revealElements.forEach(el => observer.observe(el));

    
    const staggerItems = document.querySelectorAll('.stagger-load > *');
    staggerItems.forEach((item, index) => {
        item.style.animationDelay = `${index * 50}ms`;
        item.classList.add('animate-in');
    });
});

function switchCustomerView(viewId) {
    
    document.querySelectorAll('[id^="view-"]').forEach(el => {
        el.classList.add('hidden');
        
        el.querySelectorAll('.reveal, .reveal-grid').forEach(r => r.classList.remove('active'));
    });
    
    
    const view = document.getElementById(viewId);
    if(view) {
        view.classList.remove('hidden');
        
        setTimeout(() => {
            view.querySelectorAll('.reveal, .reveal-grid').forEach(r => r.classList.add('active'));
        }, 50);
    }
    
    
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active', 'text-white'));
    
    const activeNavId = viewId.replace('view-', 'nav-cust-');
    const activeNav = document.getElementById(activeNavId);
    if(activeNav) activeNav.classList.add('active', 'text-white');
    
    history.replaceState(null, null, `#${viewId.replace('view-', '')}`);
}
