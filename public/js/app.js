// public/js/app.js
document.addEventListener('DOMContentLoaded', () => {
    
    // Router simple
    const showView = (viewId) => {
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.add('active');
        }
    };

    // Check auth state on load
    if (Auth.isAuthenticated()) {
        const user = Auth.getUser();
        if (user.role === 'guard') {
            showView('view-guard');
        } else {
            showView('view-dashboard');
            document.getElementById('user-name').textContent = user.name;
        }
    } else {
        showView('view-login');
    }

    // Login Form Submit
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            
            const btn = loginForm.querySelector('button');
            const originalText = btn.textContent;
            btn.textContent = 'Cargando...';
            btn.disabled = true;

            const user = await Auth.login(email, password);
            
            if (user) {
                if (user.role === 'guard') {
                    showView('view-guard');
                } else {
                    showView('view-dashboard');
                    document.getElementById('user-name').textContent = user.name;
                }
            }
            
            btn.textContent = originalText;
            btn.disabled = false;
        });
    }

    // Logout Buttons
    document.getElementById('btn-logout')?.addEventListener('click', Auth.logout);
    document.getElementById('btn-logout-guard')?.addEventListener('click', Auth.logout);

});
