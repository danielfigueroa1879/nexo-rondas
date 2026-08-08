// public/js/auth.js
class Auth {
    static async login(email, password) {
        if (!supabase) {
            alert("Por favor, configura las credenciales de Supabase en api.js primero.");
            return null;
        }
        
        try {
            // Nota: En Supabase el login estándar es con Email, no RUT por defecto.
            // Para login con RUT, tendríamos que guardar el RUT en el perfil de usuario 
            // o crear un sistema custom, pero para integrarnos rápido a Supabase usaremos el email asociado.
            const { data, error } = await supabase.auth.signInWithPassword({
                email: email, // El form HTML todavía dice RUT, lo cambiaremos luego o simularemos que rut = email.
                password: password,
            });

            if (error) throw error;
            
            // Get user role from a custom table 'users' linked to auth.users
            const { data: profile } = await supabase
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
        if (supabase) {
            await supabase.auth.signOut();
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
