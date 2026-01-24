#!/usr/bin/env python3
# ========== INSTAGRAM COMMENT FETCHER ==========
# Usa Instaloader para buscar comentarios de um post

import instaloader
import json
import sys
import os
import base64
import tempfile
from datetime import datetime

def get_loader_with_session(username='nextleveldj1'):
    """
    Cria instancia do Instaloader com sessao
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

    # Tentar carregar sessao salva
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
                session_data = base64.b64decode(session_b64)
                temp_session = os.path.join(tempfile.gettempdir(), f'session-{username}')
                with open(temp_session, 'wb') as f:
                    f.write(session_data)
                L.load_session_from_file(username, temp_session)
                logged_in = True
                print(f"[INFO] Sessao carregada (env var)", file=sys.stderr)
            except Exception as e:
                print(f"[WARN] Falha ao carregar sessao do ambiente: {e}", file=sys.stderr)

    return L, logged_in


def fetch_comments(shortcode, limit=500):
    """
    Busca comentarios de um post do Instagram

    Args:
        shortcode: Codigo do post (ex: CxYz123)
        limit: Numero maximo de comentarios

    Returns:
        dict com lista de comentarios
    """
    L, logged_in = get_loader_with_session()

    try:
        post = instaloader.Post.from_shortcode(L.context, shortcode)
        # Força carregar os metadados
        _ = post.caption
    except instaloader.exceptions.BadResponseException:
        return {'error': 'Post nao encontrado ou acesso negado', 'shortcode': shortcode}
    except Exception as e:
        return {'error': str(e), 'shortcode': shortcode}

    comments = []
    count = 0

    try:
        for comment in post.get_comments():
            if count >= limit:
                break

            comment_data = {
                'id': comment.id,
                'text': comment.text,
                'author': comment.owner.username,
                'author_id': comment.owner.userid,
                'author_profile_pic': comment.owner.profile_pic_url,
                'author_verified': comment.owner.is_verified,
                'likes': comment.likes_count,
                'timestamp': comment.created_at_utc.isoformat() if comment.created_at_utc else None,
                'answers_count': comment.answers_count if hasattr(comment, 'answers_count') else 0,
            }

            # Buscar respostas (sub-comentarios)
            if hasattr(comment, 'answers') and comment.answers_count > 0:
                replies = []
                try:
                    for reply in comment.answers:
                        replies.append({
                            'id': reply.id,
                            'text': reply.text,
                            'author': reply.owner.username,
                            'likes': reply.likes_count,
                            'timestamp': reply.created_at_utc.isoformat() if reply.created_at_utc else None,
                        })
                        if len(replies) >= 10:  # Limitar respostas por comentario
                            break
                except Exception:
                    pass  # Ignora erros ao buscar respostas
                comment_data['replies'] = replies

            comments.append(comment_data)
            count += 1

            # Log de progresso a cada 50 comentarios
            if count % 50 == 0:
                print(f"[INFO] {count} comentarios processados...", file=sys.stderr)

    except instaloader.exceptions.QueryReturnedBadRequestException:
        if comments:
            pass  # Retorna o que conseguiu
        else:
            return {'error': 'Rate limited pelo Instagram', 'shortcode': shortcode}
    except Exception as e:
        if comments:
            pass  # Retorna o que conseguiu
        else:
            return {'error': str(e), 'shortcode': shortcode}

    # Informacoes do post
    caption = post.caption if post.caption else ''
    caption_clean = caption.split('\n')[0][:100] if caption else 'Sem titulo'

    return {
        'shortcode': shortcode,
        'post_caption': caption_clean,
        'post_url': f'https://www.instagram.com/p/{shortcode}/',
        'total_comments_on_post': post.comments,
        'fetched_comments': len(comments),
        'comments': comments,
        'fetched_at': datetime.utcnow().isoformat(),
        'logged_in': logged_in
    }


if __name__ == '__main__':
    if len(sys.argv) < 2:
        print(json.dumps({'error': 'Uso: python fetch_comments.py <shortcode> [limit]'}))
        sys.exit(1)

    shortcode = sys.argv[1]
    limit = int(sys.argv[2]) if len(sys.argv) > 2 else 500

    result = fetch_comments(shortcode, limit)
    print(json.dumps(result, ensure_ascii=False))
