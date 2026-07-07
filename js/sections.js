document.addEventListener('DOMContentLoaded', function () {
    const WA = 'https://wa.me/5511947873054?text=Ol%C3%A1!%20Gostaria%20de%20agendar%20uma%20avalia%C3%A7%C3%A3o%20com%20a%20Dra.%20Milene%20Miranda.';

    // Header scroll
    const header = document.querySelector('.site-header');
    if (header) {
        const onScroll = () => header.classList.toggle('scrolled', window.scrollY > 40);
        window.addEventListener('scroll', onScroll);
        onScroll();
    }

    // Mobile menu
    const toggle = document.querySelector('.menu-toggle');
    const mobileMenu = document.querySelector('.mobile-menu');
    if (toggle && mobileMenu) {
        toggle.addEventListener('click', () => {
            const open = mobileMenu.classList.toggle('open');
            toggle.setAttribute('aria-expanded', open);
        });
        mobileMenu.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenu.classList.remove('open');
                toggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    // Depoimentos carousel
    if (document.querySelector('.depoimentos-swiper')) {
        new Swiper('.depoimentos-swiper', {
            loop: true,
            slidesPerView: 1,
            spaceBetween: 16,
            navigation: {
                nextEl: '.depoimentos-nav .swiper-button-next',
                prevEl: '.depoimentos-nav .swiper-button-prev',
            },
            breakpoints: {
                768: { slidesPerView: 2 },
                1024: { slidesPerView: 3 },
            },
        });
    }

    // Contact form → WhatsApp
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', function (e) {
            e.preventDefault();
            const msgEl = document.getElementById('form-message');
            const nome = contactForm.nome.value.trim();
            const telefone = contactForm.telefone.value.trim();
            const email = contactForm.email.value.trim();
            const mensagem = contactForm.mensagem.value.trim();
            const interesse = contactForm.interesse.value.trim();

            if (!nome || !telefone || !email || !mensagem) {
                msgEl.textContent = 'Por favor, preencha todos os campos obrigatórios.';
                msgEl.className = 'form-message error';
                return;
            }

            msgEl.className = 'form-message';

            let text = `Olá! Gostaria de agendar uma avaliação com a Dra. Milene Miranda.\n\n`;
            text += `Nome: ${nome}\nTelefone: ${telefone}\nE-mail: ${email}\n`;
            if (interesse) text += `Tratamento de interesse: ${interesse}\n`;
            text += `\nMensagem: ${mensagem}`;

            window.open(`https://wa.me/5511947873054?text=${encodeURIComponent(text)}`, '_blank');
        });
    }
});
