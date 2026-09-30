$ErrorActionPreference = "Stop"
$root = (Resolve-Path "$PSScriptRoot/..").Path
Set-Location $root
python -m pip install -r engine/requirements.txt pyinstaller==6.22.3 pytest==9.1.1
if ($LASTEXITCODE -ne 0) { throw "Python dependency installation failed" }
python -m PyInstaller --noconfirm --clean --onedir --name pdfmerge-engine --distpath src-tauri/resources --workpath build/pyinstaller --specpath build --paths engine --collect-all pypdfium2 --collect-all pypdfium2_raw --collect-all reportlab --collect-all pyhanko --collect-all pyhanko_certvalidator --collect-all cryptography --collect-all cv2 --collect-all pdfminer --collect-all docx --collect-all pptx engine/main.py
if ($LASTEXITCODE -ne 0) { throw "Engine packaging failed" }
$engines = Join-Path $root "src-tauri/resources/engines"
New-Item -ItemType Directory -Force $engines | Out-Null
$downloads = Join-Path $root "build/downloads"
New-Item -ItemType Directory -Force $downloads | Out-Null
$office = Join-Path $engines "libreoffice"
if (!(Test-Path "$office/program/soffice.exe")) {
    $msi = Join-Path $downloads "LibreOffice.msi"
    Invoke-WebRequest "https://download.documentfoundation.org/libreoffice/stable/26.2.6/win/x86_64/LibreOffice_26.2.6_Win_x86-64.msi" -OutFile $msi
    if ((Get-FileHash $msi -Algorithm SHA256).Hash.ToLower() -ne "f9877032fd908beb9c0ddf06df4af5c2e85f419c42e14876c4cce5aae5fb2660") { throw "LibreOffice checksum mismatch" }
    $proc = Start-Process msiexec.exe -ArgumentList "/a `"$msi`" /qn TARGETDIR=`"$office`" /L*v `"$downloads/office.log`"" -Wait -PassThru
    if ($proc.ExitCode -ne 0) { throw "LibreOffice extraction failed: $($proc.ExitCode)" }
    # Administrative images may add a product directory depending on MSI layout.
    if (!(Test-Path "$office/program/soffice.exe")) {
        $exe = Get-ChildItem $office -Recurse -Filter soffice.exe | Select-Object -First 1
        if (!$exe) { throw "LibreOffice executable missing" }
        $actual = Split-Path (Split-Path $exe.FullName)
        $stage = Join-Path $engines "office-stage"
        Move-Item $actual $stage
        Remove-Item $office -Recurse -Force
        Move-Item $stage $office
    }
    Get-ChildItem $office -Filter *.msi | Remove-Item
}
$tesseract = Join-Path $engines "tesseract"
if (!(Test-Path "$tesseract/tesseract.exe")) {
    $installer = Join-Path $downloads "tesseract.exe"
    Invoke-WebRequest "https://github.com/tesseract-ocr/tesseract/releases/download/5.5.0/tesseract-ocr-w64-setup-5.5.0.20241111.exe" -OutFile $installer
    $proc = Start-Process $installer -ArgumentList "/S /D=$tesseract" -Wait -PassThru
    if (!(Test-Path "$tesseract/tesseract.exe")) { throw "Tesseract extraction failed" }
}
foreach ($lang in @("eng","hin","osd")) {
    if (!(Test-Path "$tesseract/tessdata/$lang.traineddata")) {
        Invoke-WebRequest "https://raw.githubusercontent.com/tesseract-ocr/tessdata_fast/4.1.0/$lang.traineddata" -OutFile "$tesseract/tessdata/$lang.traineddata"
    }
}
python scripts/collect-licenses.py
if ($LASTEXITCODE -ne 0) { throw "License collection failed" }
$env:PDFMERGE_RESOURCES = $engines
python -m pytest engine/test_engine.py engine/test_packaged.py -q
if ($LASTEXITCODE -ne 0) { throw "Engine tests failed" }
