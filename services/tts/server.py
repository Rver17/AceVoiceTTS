"""Stop the local engine when its owning desktop process exits."""
import ctypes
import os
import sys
import threading
import time

import uvicorn


def watch_desktop(owner):
    if os.name == "nt":
        from ctypes import wintypes
        kernel = ctypes.WinDLL("kernel32", use_last_error=True)
        kernel.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
        kernel.OpenProcess.restype = wintypes.HANDLE
        kernel.WaitForSingleObject.argtypes = [wintypes.HANDLE, wintypes.DWORD]
        handle = kernel.OpenProcess(0x00100000, False, owner)
        if handle:
            kernel.WaitForSingleObject(handle, 0xFFFFFFFF)
    else:
        while os.getppid() == owner:
            time.sleep(1)
    os._exit(0)


if __name__ == "__main__":
    threading.Thread(target=watch_desktop, args=(int(sys.argv[2]),), daemon=True).start()
    uvicorn.run("app:app", host="127.0.0.1", port=int(sys.argv[1]), access_log=False)
