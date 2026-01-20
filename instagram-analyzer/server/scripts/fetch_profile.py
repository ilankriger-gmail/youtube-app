#!/usr/bin/env python3
# ========== INSTAGRAM PROFILE FETCHER ==========
# Usa Instaloader para buscar videos de um perfil

import instaloader
import json
import sys
import os
import base64
import tempfile
from datetime import datetime

def fetch_profile(username, media_type='all', limit=100):
    """
    Busca videos de um perfil do Instagram

    Args:
        username: Nome do usuario (sem @)
        media_type: 'posts', 'reels', ou 'all'
        limit: Numero maximo de videos

    Returns:
        dict com dados do perfil e lista de videos
    """
    L = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
        quiet=True
    )

    # Tentar carregar sessao salva (permite acesso a historico completo)
    session_file = os.path.expanduser(f'~/.config/instaloader/session-{username}')
    logged_in = False

    # Primeiro tenta arquivo local
    try:
        if os.path.exists(session_file):
            L.load_session_from_file(username, session_file)
            logged_in = True
            print(f"[INFO] Sessao carregada (arquivo): {session_file}", file=sys.stderr)
    except Exception as e:
        print(f"[WARN] Falha ao carregar sessao local: {e}", file=sys.stderr)

    # Se nao tem arquivo local, tenta variavel de ambiente (para Railway)
    if not logged_in:
        session_b64 = os.environ.get('INSTAGRAM_SESSION')
        if session_b64:
            try:
                # Decodifica base64 e salva em arquivo temporario
                session_data = base64.b64decode(session_b64)
                temp_session = os.path.join(tempfile.gettempdir(), f'session-{username}')
                with open(temp_session, 'wb') as f:
                    f.write(session_data)
                L.load_session_from_file(username, temp_session)
                logged_in = True
                print(f"[INFO] Sessao carregada (env var)", file=sys.stderr)
            except Exception as e:
                print(f"[WARN] Falha ao carregar sessao do ambiente: {e}", file=sys.stderr)

    try:
        profile = instaloader.Profile.from_username(L.context, username)
    except instaloader.exceptions.ProfileNotExistsException:
        return {'error': 'Perfil nao encontrado', 'username': username}
    except instaloader.exceptions.PrivateProfileNotFollowedException:
        return {'error': 'Perfil privado', 'username': username}
    except Exception as e:
        return {'error': str(e), 'username': username}

    videos = []
    count = 0

    try:
        for post in profile.get_posts():
            if count >= limit:
                break

            # Pular se nao for video
            if not post.is_video:
                continue

            # Filtrar por tipo
            is_reel = getattr(post, 'product_type', '') == 'clips' or post.typename == 'GraphVideo'

            if media_type == 'reels' and not is_reel:
                continue
            if media_type == 'posts' and is_reel:
                continue

            # Extrair dados
            caption = post.caption if post.caption else ''
            # Limpar caption - pegar primeira linha ou primeiros 100 chars
            caption_clean = caption.split('\n')[0][:100] if caption else 'Sem titulo'

            video_data = {
                'shortcode': post.shortcode,
                'thumbnail': post.url,
                'caption': caption_clean,
                'caption_full': caption[:500] if caption else '',
                'views': post.video_play_count or post.video_view_count or 0,
                'likes': post.likes or 0,
                'comments': post.comments or 0,
                'duration': post.video_duration or 0,
                'timestamp': post.date_utc.isoformat() if post.date_utc else None,
                'type': 'reel' if is_reel else 'post',
                'url': f'https://www.instagram.com/p/{post.shortcode}/',
                'video_url': post.video_url
            }

            videos.append(video_data)
            count += 1

    except instaloader.exceptions.QueryReturnedBadRequestException:
        return {'error': 'Rate limited pelo Instagram. Tente novamente em alguns minutos.', 'username': username}
    except Exception as e:
        # Retorna o que conseguiu ate o erro
        if videos:
            pass  # Continua com os videos que conseguiu
        else:
            return {'error': str(e), 'username': username}

    return {
        'username': profile.username,
        'full_name': profile.full_name,
        'profile_pic': profile.profile_pic_url,
        'followers': profile.followers,
        'following': profile.followees,
        'posts_count': profile.mediacount,
        'bio': profile.biography,
        'is_private': profile.is_private,
        'videos': videos,
        'fetched_at': datetime.utcnow().isoformat(),
        'logged_in': logged_in
    }


def fetch_single_post(shortcode):
    """
    Busca dados de um post especifico pelo shortcode
    """
    L = instaloader.Instaloader(
        download_pictures=False,
        download_videos=False,
        download_video_thumbnails=False,
        download_geotags=False,
        download_comments=False,
        save_metadata=False,
        compress_json=False,
        quiet=True
    )

    try:
        post = instaloader.Post.from_shortcode(L.context, shortcode)

        if not post.is_video:
            return {'error': 'Este post nao e um video', 'shortcode': shortcode}

        caption = post.caption if post.caption else ''
        caption_clean = caption.split('\n')[0][:100] if caption else 'Sem titulo'

        return {
            'shortcode': post.shortcode,
            'thumbnail': post.url,
            'caption': caption_clean,
            'caption_full': caption[:500] if caption else '',
            'views': post.video_play_count or post.video_view_count or 0,
            'likes': post.likes or 0,
            'comments': post.comments or 0,
            'duration': post.video_duration or 0,
            'timestamp': post.date_utc.isoformat() if post.date_utc else None,
            'type': 'reel' if getattr(post, 'product_type', '') == 'clips' else 'post',
            'url': f'https://www.instagram.com/p/{post.shortcode}/',
            'video_url': post.video_url,
            'owner': post.owner_username
        }

    except Exception as e:
        return {'error': str(e), 'shortcode': shortcode}


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Uso: python fetch_profile.py <username|shortcode> [type] [limit]'}))
        sys.exit(1)

    arg1 = sys.argv[1]

    # Se parece com shortcode (11 caracteres alfanumericos), busca post unico
    if len(arg1) == 11 and arg1.isalnum():
        result = fetch_single_post(arg1)
    else:
        # Remover @ se presente
        username = arg1.lstrip('@')
        media_type = sys.argv[2] if len(sys.argv) > 2 else 'all'
        limit = int(sys.argv[3]) if len(sys.argv) > 3 else 100
        result = fetch_profile(username, media_type, limit)

    print(json.dumps(result, ensure_ascii=False))
