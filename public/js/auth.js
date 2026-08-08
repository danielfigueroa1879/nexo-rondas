// public/js/auth.js
class Auth {
    static async login(email, password) {
        // MODO DEMO y Validación de Guardias Locales
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

        // MODO DEMO: Credenciales de administrador predefinidas
        if (email === 'admin@empresa.com' && password === '123456') {
            const adminUser = {
                id: 'admin-demo-001',
                email: email,
                role: 'admin',
                name: 'Administrador'
            };
            localStorage.setItem('nexo_user', JSON.stringify(adminUser));
            return adminUser;
        }

        if (!supabaseClient) {
            console.warn("MODO DEMO ACTIVADO: Usando datos simulados porque no hay Supabase configurado.");
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

        try {
            const { data, error } = await supabaseClient.auth.signInWithPassword({
                email: email, 
                password: password,
            });

            if (error) throw error;
            
            // Get user role from a custom table 'users' linked to auth.users
            const { data: profile } = await supabaseClient
                .from('users')
                .select('*')
                .eq('id', data.user.id)
                .single();

            const userObj = {
                id: data.user.id,
                email: data.user.email,
                role: profile ? profile.role : 'admin', // default to admin for demo if no profile
                name: profile ? profile.name : 'Administrador'
            };

            localStorage.setItem('nexo_user', JSON.stringify(userObj));
            return userObj;

        } catch (error) {
            alert(error.message);
            return null;
        }
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
