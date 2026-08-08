// public/js/app.js
document.addEventListener('DOMContentLoaded', () => {
    
    // Router simple
    const showView = (viewId) => {
        document.querySelectorAll('.view').forEach(v => {
            v.classList.remove('active');
            v.style.display = 'none';
        });
        const targetView = document.getElementById(viewId);
        if (targetView) {
            targetView.classList.add('active');
            if (viewId === 'view-guard') {
                targetView.style.display = 'flex';
            } else {
                targetView.style.display = 'block';
            }
        }
    };

    // Check auth state on load
    // Show login initially if not authenticated
    if (!Auth.isAuthenticated()) {
        showView('view-login');
    } else {
        // If already logged in, show the appropriate view
        const user = Auth.getUser();
        if (user.role === 'guard') {
            showView('view-guard');
        } else {
            showView('view-dashboard');
            document.getElementById('user-name').textContent = user.name;
        }
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

            try {
                const user = await Auth.login(email, password);
                
                if (user) {
                    if (user.role === 'guard') {
                        showView('view-guard');
                        if (typeof GuardApp !== 'undefined') GuardApp.init();
                    } else {
                        showView('view-dashboard');
                        document.getElementById('user-name').textContent = user.name;
                        if (typeof AdminPanel !== 'undefined') AdminPanel.init();
                        if (typeof SupervisorDashboard !== 'undefined') SupervisorDashboard.init();
                    }
                }
            } catch (err) {
                console.error(err);
                alert("Error al iniciar sesión: " + err.message);
            } finally {
                btn.textContent = originalText;
                btn.disabled = false;
            }
        });
    }

    // Logout Buttons
    document.getElementById('btn-logout')?.addEventListener('click', Auth.logout);
    document.getElementById('btn-logout-guard')?.addEventListener('click', Auth.logout);

});
