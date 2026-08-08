// public/js/auth.js
class Auth {
    static async login(email, password) {
        // MODO DEMO: Si no hay credenciales reales de Supabase configuradas, permite el acceso para ver la interfaz
        if (!supabaseClient) {
            console.warn("MODO DEMO ACTIVADO: Usando datos simulados porque no hay Supabase configurado.");
            const isGuard = email.includes('guardia');
            const demoUser = {
                id: 'demo-id-123',
                email: email,
                role: isGuard ? 'guard' : 'admin',
                name: isGuard ? 'Guardia Demo' : 'Administrador Demo'
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
