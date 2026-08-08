// public/js/auth.js
class Auth {
    static async login(email, password) {

        // ─── 1. Admin hardcodeado (demo + cuenta real) ───
        const adminAccounts = [
            { email: 'admin@empresa.com',          password: '123456' },
            { email: 'danielfigueroa1879@gmail.com', password: 'Acua4040_' }
        ];
        const isAdmin = adminAccounts.find(a => a.email === email && a.password === password);
        if (isAdmin) {
            const adminUser = {
                id: 'admin-' + email,
                email: email,
                role: 'admin',
                name: email === 'admin@empresa.com' ? 'Administrador' : 'Daniel Figueroa'
            };
            localStorage.setItem('nexo_user', JSON.stringify(adminUser));
            return adminUser;
        }

        // ─── 2. Buscar guardia en Supabase (acceso desde cualquier dispositivo) ───
        if (supabaseClient) {
            try {
                const { data: guardData, error } = await supabaseClient
                    .from('guards')
                    .select('*')
                    .eq('email', email)
                    .eq('password', password)
                    .maybeSingle();

                if (guardData) {
                    const userObj = {
                        id: guardData.id,
                        email: guardData.email,
                        role: 'guard',
                        name: guardData.name,
                        facilityId: guardData.facility_id,
                        facilityName: guardData.facility_name
                    };
                    localStorage.setItem('nexo_user', JSON.stringify(userObj));
                    return userObj;
                }
            } catch (e) {
                console.warn('Error consultando Supabase guards:', e.message);
            }
        }

        // ─── 3. Fallback: buscar en localStorage (guardias registrados localmente) ───
        const localGuards = JSON.parse(localStorage.getItem('nexo_guards') || '[]');
        const matchedGuard = localGuards.find(g => g.email === email && g.password === password);

        if (matchedGuard) {
            const userObj = {
                id: matchedGuard.id,
                email: matchedGuard.email,
                role: 'guard',
                name: matchedGuard.name,
                facilityId: matchedGuard.facilityId,
                facilityName: matchedGuard.facilityName
            };
            localStorage.setItem('nexo_user', JSON.stringify(userObj));
            return userObj;
        }

        // ─── 4. Modo demo para cualquier email ───
        if (!supabaseClient) {
            const isGuard = email.includes('guardia');
            const demoUser = {
                id: 'demo-id-123',
                email: email,
                role: isGuard ? 'guard' : 'admin',
                name: isGuard ? 'Guardia Demo' : 'Administrador Demo',
                facilityName: isGuard ? 'Instalación Demo' : ''
            };
            localStorage.setItem('nexo_user', JSON.stringify(demoUser));
            return demoUser;
        }

        // ─── 5. Credenciales incorrectas ───
        alert('Correo o contraseña incorrectos. Verifica tus credenciales.');
        return null;
    }


    static async logout() {
        if (supabaseClient) {
            await supabaseClient.auth.signOut();
        }
        localStorage.removeItem('nexo_user');
        window.location.reload();
    }

    static isAuthenticated() {
        return !!localStorage.getItem('nexo_user');
    }

    static getUser() {
        const user = localStorage.getItem('nexo_user');
        return user ? JSON.parse(user) : null;
    }
}
