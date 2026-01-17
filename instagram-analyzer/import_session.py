#!/usr/bin/env python3
"""
Importa sessão do Instagram a partir do navegador
"""

import instaloader
import os
import sys

USERNAME = 'nextleveldj1'

def try_browser(browser_name):
    """Tenta importar sessão de um navegador"""
    print(f"\nTentando importar do {browser_name}...")

    L = instaloader.Instaloader()

    try:
        L.load_session_from_file(USERNAME)
    except:
        pass

    try:
        # Importar cookies do navegador
        L.context.load_session_from_browser(browser_name.lower())

        # Testar se funciona
        profile = instaloader.Profile.from_username(L.context, USERNAME)
        print(f"✓ Sucesso! Logado como @{profile.username}")
        print(f"  Posts: {profile.mediacount}")

        # Salvar sessão
        session_dir = os.path.expanduser('~/.config/instaloader')
        os.makedirs(session_dir, exist_ok=True)
        L.save_session_to_file(USERNAME)
        print(f"✓ Sessão salva!")

        return True

    except Exception as e:
        print(f"✗ Falhou: {e}")
        return False

def main():
    print("=== Importar Sessão do Navegador ===")
    print("\nCertifique-se de estar LOGADO no Instagram no navegador!\n")

    # Tentar diferentes navegadores
    browsers = ['chrome', 'safari', 'firefox', 'edge']

    for browser in browsers:
        if try_browser(browser):
            print("\n=== Sessão importada com sucesso! ===")
            print("Agora você pode atualizar os vídeos no app.")
            return

    print("\n" + "="*50)
    print("Nenhum navegador funcionou.")
    print("\nTente:")
    print("1. Abra o Safari/Chrome")
    print("2. Vá para instagram.com")
    print("3. Faça login na sua conta @nextleveldj1")
    print("4. Execute este script novamente")
    print("="*50)

if __name__ == '__main__':
    main()
