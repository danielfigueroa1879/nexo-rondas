// public/js/auth.js
class Auth {
    static async login(rut, password) {
        try {
            const response = await ApiService.request('/auth/login', 'POST', { rut, password });
            if (response.token) {
                localStorage.setItem('nexo_token', response.token);
                localStorage.setItem('nexo_user', JSON.stringify(response.user));
                return response.user;
            }
        } catch (error) {
            alert(error.message);
            return null;
        }
    }

    static logout() {
        localStorage.removeItem('nexo_token');
        localStorage.removeItem('nexo_user');
        window.location.reload();
    }

    static isAuthenticated() {
        return !!localStorage.getItem('nexo_token');
    }

    static getUser() {
        const user = localStorage.getItem('nexo_user');
        return user ? JSON.parse(user) : null;
    }
}
