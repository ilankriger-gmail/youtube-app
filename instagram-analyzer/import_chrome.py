#!/usr/bin/env python3
"""
Importa sessão do Instagram a partir dos cookies do Chrome
"""

import browser_cookie3
import requests
import json
import os
import pickle

USERNAME = 'nextleveldj1'

def get_instagram_cookies_from_chrome():
    """Extrai cookies do Instagram do Chrome"""
    print("Extraindo cookies do Chrome...")

    try:
        # Pegar todos os cookies do Chrome para instagram.com
        cookies = browser_cookie3.chrome(domain_name='.instagram.com')

        cookie_dict = {}
        for cookie in cookies:
            cookie_dict[cookie.name] = cookie.value

        print(f"✓ Encontrados {len(cookie_dict)} cookies do Instagram")
        return cookie_dict

    except Exception as e:
        print(f"✗ Erro ao extrair cookies: {e}")
        return None

def test_session(cookies):
    """Testa se os cookies funcionam"""
    print("\nTestando sessão...")

    session = requests.Session()

    # Adicionar cookies
    for name, value in cookies.items():
        session.cookies.set(name, value, domain='.instagram.com')

    # Headers padrão do Instagram
    headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'X-IG-App-ID': '936619743392459',
        'X-Requested-With': 'XMLHttpRequest',
    }

    # Testar pegando info do usuário logado
    try:
        resp = session.get(
            'https://www.instagram.com/api/v1/users/web_profile_info/?username=' + USERNAME,
            headers=headers
        )

        if resp.status_code == 200:
            data = resp.json()
            user = data.get('data', {}).get('user', {})
            if user:
                print(f"✓ Sessão válida!")
                print(f"  Usuário: @{user.get('username')}")
                print(f"  Posts: {user.get('edge_owner_to_timeline_media', {}).get('count', 0)}")
                return True

        print(f"✗ Resposta inválida: {resp.status_code}")
        return False

    except Exception as e:
        print(f"✗ Erro no teste: {e}")
        return False

def create_instaloader_session(cookies):
    """Cria arquivo de sessão do Instaloader a partir dos cookies"""
    print("\nCriando sessão do Instaloader...")

    import instaloader

    L = instaloader.Instaloader()

    # Criar session do requests com os cookies
    session = requests.Session()
    for name, value in cookies.items():
        session.cookies.set(name, value, domain='.instagram.com')

    # Copiar cookies para o contexto do Instaloader
    L.context._session.cookies.update(session.cookies)

    # Tentar salvar
    try:
        session_dir = os.path.expanduser('~/.config/instaloader')
        os.makedirs(session_dir, exist_ok=True)
        session_file = os.path.join(session_dir, f'session-{USERNAME}')

        # Salvar usando pickle (formato do instaloader)
        with open(session_file, 'wb') as f:
            pickle.dump(L.context._session.cookies, f)

        print(f"✓ Sessão salva em: {session_file}")
        return True

    except Exception as e:
        print(f"✗ Erro ao salvar: {e}")
        return False

def main():
    print("=== Importar Sessão do Chrome ===\n")
    print("Certifique-se de estar LOGADO no Instagram no Chrome!\n")

    # 1. Extrair cookies
    cookies = get_instagram_cookies_from_chrome()
    if not cookies:
        return

    # Verificar cookies essenciais
    essential = ['sessionid', 'csrftoken', 'ds_user_id']
    missing = [c for c in essential if c not in cookies]
    if missing:
        print(f"\n⚠ Cookies faltando: {missing}")
        print("Você precisa estar LOGADO no Instagram no Chrome!")
        return

    print(f"✓ Cookies essenciais encontrados: {essential}")

    # 2. Testar se funciona
    if not test_session(cookies):
        print("\nA sessão não está funcionando.")
        print("Tente fazer logout e login novamente no Chrome.")
        return

    # 3. Criar sessão do Instaloader
    create_instaloader_session(cookies)

    print("\n" + "="*50)
    print("✓ SUCESSO! Sessão importada do Chrome.")
    print("Agora clique em 'Atualizar' no app para buscar todos os vídeos.")
    print("="*50)

if __name__ == '__main__':
    main()
