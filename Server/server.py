#!/usr/bin/env python3
from http.server import HTTPServer, BaseHTTPRequestHandler
from datetime import datetime

PORT = 80

# HTML estático que se servirá
HTML_CONTENT = """
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Mi Servidor HTTP</title>
    <style>
        html {{
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            }}
        body {{
            font-family: Arial, sans-serif;
            with: 100vw;
            height: 100vh;
            margin: 50px auto;
            padding: 20px;
            color: white;
        }}
        .container {{
            background: rgba(255, 255, 255, 0.1);
            padding: 30px;
            border-radius: 10px;
            backdrop-filter: blur(10px);
        }}
        h1 {{
            text-align: center;
            margin-bottom: 20px;
        }}
        p {{
            line-height: 1.6;
        }}
        .info {{
            background: rgba(255, 255, 255, 0.2);
            padding: 15px;
            border-radius: 5px;
            margin-top: 20px;
        }}
    </style>
</head>
<body>
    <div class="container">
        <h1>¡Servidor HTTP Funcionando! 🚀</h1>
        <p>Este es un servidor HTTP simple hecho con Python que sirve contenido HTML estático.</p>
        <div class="info">
            <p><strong>Puerto:</strong> {port}</p>
            <p><strong>Hora del servidor:</strong> {time}</p>
        </div>
    </div>
</body>
</html>
"""


class SimpleHTTPRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        # Configurar respuesta exitosa
        self.send_response(200)
        self.send_header("Content-type", "text/html; charset=utf-8")
        self.end_headers()

        # Generar HTML con información dinámica
        html = HTML_CONTENT.format(
            port=PORT, time=datetime.now().strftime("%d/%m/%Y %H:%M:%S")
        )

        # Enviar el HTML
        self.wfile.write(html.encode("utf-8"))

        # Log en consola
        print(f"✓ Solicitud recibida: {self.path}")

    def log_message(self, format, *args):
        # Personalizar el log del servidor
        pass


def run_server():
    server_address = ("0.0.0.0", PORT)
    httpd = HTTPServer(server_address, SimpleHTTPRequestHandler)

    print(f"✅ Servidor ejecutándose en http://{server_address[0]}:{PORT}")
    print("Presiona Ctrl+C para detener el servidor")

    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\n\n❌ Servidor detenido")
        httpd.server_close()


if __name__ == "__main__":
    run_server()
