"""Une el video de pantalla de la demo con la grabación de la cámara y la voz.

Uso:  python scripts/unir_video.py <grabacion-camara.mp4> <segundos|auto> [salida.mp4]
Ejemplo: python scripts/unir_video.py video/camara.mp4 auto
- "estirar" (lo más simple): no hace falta sincronizar nada; el video de pantalla se estira o acorta para durar lo mismo que tu grabación.
- "auto" busca el aplauso (el sonido más fuerte de los primeros 25 s) y lo toma como el momento en que arrancó la demo.

- La pantalla de la demo va de fondo y la cámara, chica, abajo a la izquierda.
- El audio es el de la grabación de la cámara (tu voz).
- Mientras no arranca la demo (los primeros segundos), se ve su primer cuadro quieto.
- Necesita ffmpeg (python -m pip install imageio-ffmpeg).
"""
import struct
import subprocess
import sys

import imageio_ffmpeg

if len(sys.argv) < 3:
    sys.exit(__doc__)

camara = sys.argv[1]
FF = imageio_ffmpeg.get_ffmpeg_exe()


def detectar_aplauso(ruta):
    """Segundo del sonido más fuerte en los primeros 25 s (ventanas de 10 ms)."""
    crudo = subprocess.run([FF, "-v", "error", "-i", ruta, "-t", "25", "-vn", "-ac", "1", "-ar", "8000", "-f", "s16le", "-"], capture_output=True).stdout
    muestras = struct.unpack("<%dh" % (len(crudo) // 2), crudo[: len(crudo) // 2 * 2])
    mejor, mejor_i = 0, 0
    for i in range(0, len(muestras) - 80, 80):
        v = max(abs(x) for x in muestras[i : i + 80])
        if v > mejor:
            mejor, mejor_i = v, i // 80
    return mejor_i / 100.0


def duracion(ruta):
    err = subprocess.run([FF, "-i", ruta], capture_output=True, text=True).stderr
    h, m, s = err.split("Duration:")[1].split(",")[0].strip().split(":")
    return int(h) * 3600 + int(m) * 60 + float(s)


try:
    recorte = float(open("video/recorte.txt").read())
except OSError:
    recorte = 0.0
DURACION_AGENDA = 100.0  # lo que dura el contenido de la agenda de scripts/video-demo.mjs (sin el sobrante del final)
factor = 1.0
if sys.argv[2] == "estirar":
    offset = 0.0
    factor = duracion(camara) / DURACION_AGENDA
    print(f"Se ajusta el video de pantalla a la duración de tu grabación (x{factor:.2f})")
else:
    offset = detectar_aplauso(camara) if sys.argv[2] == "auto" else float(sys.argv[2])
    print(f"La demo arranca en el segundo {offset:.2f} de tu grabación")
salida = sys.argv[3] if len(sys.argv) > 3 else "video/galcoa-demo-final.mp4"
demo = "video/demo-pantalla.webm"

filtro = (
    f"[1:v]trim=start={recorte}:end={recorte + DURACION_AGENDA},setpts=PTS-STARTPTS,setpts=PTS*{factor},tpad=start_duration={offset}:start_mode=clone:stop_duration=60:stop_mode=clone,"
    "scale=1280:720,setsar=1,format=yuv420p[fondo];"
    "[0:v]crop=683:595:215:0,scale=195:170,setsar=1,drawbox=x=0:y=0:w=iw:h=ih:color=0xffda47:t=3[cara];"
    "[fondo][cara]overlay=8:H-h-8[v]"
)
orden = [
    FF, "-y", "-i", camara, "-i", demo,
    "-filter_complex", filtro, "-map", "[v]", "-map", "0:a",
    "-c:v", "libx264", "-preset", "veryfast", "-crf", "23", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-b:a", "160k", "-shortest", "-movflags", "+faststart", salida,
]
print("Uniendo…")
sys.exit(subprocess.call(orden))
