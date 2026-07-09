document.addEventListener('DOMContentLoaded', function () {
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

    // Date picker: mínimo amanhã
    const dateInput = document.getElementById('agenda-data');
    if (dateInput) {
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        dateInput.min = tomorrow.toISOString().split('T')[0];
    }

    // Formulário de agendamento → Google Apps Script
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', async function (e) {
            e.preventDefault();
            const msgEl = document.getElementById('form-message');
            const submitBtn = document.getElementById('contact-submit');

            const payload = {
                nome: contactForm.nome.value.trim(),
                telefone: contactForm.telefone.value.trim(),
                email: contactForm.email.value.trim(),
                interesse: contactForm.interesse.value.trim(),
                mensagem: contactForm.mensagem.value.trim(),
                data: contactForm.data.value,
                hora: contactForm.hora.value,
            };

            if (!payload.nome || !payload.telefone || !payload.email || !payload.data || !payload.hora) {
                msgEl.textContent = 'Por favor, preencha todos os campos obrigatórios.';
                msgEl.className = 'form-message error';
                return;
            }

            if (typeof APPS_SCRIPT_URL === 'undefined' || !APPS_SCRIPT_URL) {
                msgEl.textContent = 'Sistema de agendamento em configuração. Entre em contato pelo WhatsApp.';
                msgEl.className = 'form-message error';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = 'Enviando...';
            msgEl.className = 'form-message';

            try {
                const res = await fetch(APPS_SCRIPT_URL, {
                    method: 'POST',
                    redirect: 'follow',
                    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                    body: JSON.stringify(payload),
                });

                const text = await res.text();
                let result;

                try {
                    result = JSON.parse(text);
                } catch (parseErr) {
                    msgEl.textContent = 'Resposta inválida do servidor. Tente novamente em alguns instantes.';
                    msgEl.className = 'form-message error';
                    return;
                }

                if (result.success) {
                    msgEl.textContent = result.message;
                    msgEl.className = 'form-message success';
                    contactForm.reset();
                } else {
                    msgEl.textContent = result.message || 'Não foi possível enviar. Tente novamente.';
                    msgEl.className = 'form-message error';
                }
            } catch (err) {
                msgEl.textContent = 'Erro de conexão. Tente novamente ou contate pelo WhatsApp.';
                msgEl.className = 'form-message error';
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Solicitar agendamento';
            }
        });
    }
});
