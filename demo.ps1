# Demo de Aex Prueba Pass Stellar 01 en testnet.
# Cada paso muestra el comando real del Stellar CLI, lo ejecuta al presionar
# Enter y traduce el resultado a lenguaje simple.
# Uso: doble clic en DEMO.cmd, o `pwsh -File demo.ps1`.
# Con -Ensayo la compra y el check-in solo se simulan (--send=no): no se envía nada.
param([switch]$Ensayo)

[Console]::OutputEncoding = [Text.Encoding]::UTF8
$ErrorActionPreference = 'Continue'
$env:STELLAR_NETWORK = 'testnet'

$contrato = 'aex-prueba-pass-stellar-01'
$contratoId = 'CCGIRQW6WUR4WT46DTL2EZMQBCY4SNRF622DN2VODMOYGMSFHMDPP6NW'
$comprador = 'invitado'
$anfitrion = 'anfitrion'

$errores = @{
    1 = 'InvalidPrice: precio inválido'
    2 = 'AlreadyBought: esta address ya compró su pase'
    3 = 'NoPass: esta address no tiene pase'
    4 = 'AlreadyUsed: este pase ya se usó'
}

$direccion = @{}
$direccion[$anfitrion] = (stellar keys address $anfitrion).Trim()
$direccion[$comprador] = (stellar keys address $comprador).Trim()
$nombres = @{ $direccion[$anfitrion] = 'anfitrión'; $direccion[$comprador] = 'invitado' }

function Corto([string]$a) { $a.Substring(0, 4) + '…' + $a.Substring($a.Length - 4) }
function Quien([string]$a) { if ($nombres[$a]) { "$($nombres[$a]) ($(Corto $a))" } else { Corto $a } }
function Xlm([string]$stroops) { ([decimal]$stroops / 10000000).ToString('0.#######') + ' XLM' }

function Esperar {
    if ([Console]::IsInputRedirected) { return }
    Write-Host '  (Enter)' -ForegroundColor DarkGray -NoNewline
    do { $k = [Console]::ReadKey($true) } while ($k.Key -ne 'Enter')
    Write-Host "`r          `r" -NoNewline
}

function Titulo([string]$numero, [string]$texto, [string]$explicacion) {
    Write-Host ''
    Write-Host " PASO $numero · $texto" -ForegroundColor Cyan
    Write-Host "   $explicacion" -ForegroundColor Gray
    Esperar
}

# Ejecuta el comando y devuelve lo importante: valor, link, error y eventos.
function Invocar([string]$firmante, [string[]]$funcion, [switch]$Escribe) {
    $argumentos = @('contract', 'invoke', '--id', $contrato, '--source-account', $firmante)
    if ($Ensayo -and $Escribe) { $argumentos += '--send=no' }
    $argumentos += '--'
    $argumentos += $funcion
    Write-Host ('   $ stellar ' + ($argumentos -join ' ')) -ForegroundColor Yellow

    $r = @{ Valor = $null; Tx = $null; Error = $null; Eventos = @(); Crudo = @() }
    & stellar @argumentos 2>&1 | ForEach-Object {
        $l = "$_"
        $r.Crudo += $l
        if (-not $r.Tx -and $l -match 'https://stellar\.expert/explorer/testnet/tx/[0-9a-f]{64}') {
            $r.Tx = $Matches[0]
        }
        elseif (-not $r.Error -and $l -match 'Error\(Contract, #(\d+)\)') {
            $r.Error = [int]$Matches[1]
        }
        elseif ($l -match '"symbol":"transfer"') {
            $ads = [regex]::Matches($l, '"address":"([GC][A-Z2-7]{55})"') | ForEach-Object { $_.Groups[1].Value }
            $monto = if ($l -match '"i128":"(\d+)"') { $Matches[1] } else { '0' }
            if ($ads.Count -ge 2) {
                $r.Eventos += "Pago: $(Xlm $monto) de $(Quien $ads[0]) a $(Quien $ads[1])"
            }
        }
        elseif ($l -match "$contratoId - Success - Event: \w+ \((\w+)\)") {
            $r.Eventos += "Evento del contrato: $($Matches[1])"
        }
        elseif ($l -match '^\s*(null|"[^"]*"|-?\d+)\s*$') {
            $r.Valor = $Matches[1]
        }
    }
    return $r
}

function Resultado([string]$texto, [string]$color = 'Green') {
    Write-Host "   → $texto" -ForegroundColor $color
}

function MostrarEventosYTx($r) {
    foreach ($e in $r.Eventos) { Write-Host "     · $e" -ForegroundColor Gray }
    if ($r.Tx) { Write-Host "     · Transacción: $($r.Tx)" -ForegroundColor DarkGray }
}

function FalloInesperado($r) {
    Resultado 'Algo salió distinto a lo esperado. Salida completa del CLI:' 'Red'
    $r.Crudo | ForEach-Object { Write-Host "     $_" -ForegroundColor DarkGray }
}

# ------------------------------------------------------------------

try { Clear-Host } catch { }
Write-Host ''
Write-Host ' AEX PRUEBA PASS STELLAR 01' -ForegroundColor Green
Write-Host ' Pase de acceso a un Meet · contrato Soroban en Stellar testnet' -ForegroundColor Green
Write-Host ''
Write-Host "   Contrato:   $(Corto $contratoId)"
Write-Host "   Anfitrión:  $(Corto $direccion[$anfitrion])  recibe el pago y controla la entrada"
Write-Host "   Invitado:   $(Corto $direccion[$comprador])  compra el pase y entra al Meet"
if ($Ensayo) { Write-Host '   MODO ENSAYO: la compra y el check-in solo se simulan' -ForegroundColor Magenta }

Titulo '1' 'Datos del evento' 'Leo el nombre y el precio guardados en el contrato.'
$n = Invocar $comprador @('name')
$p = Invocar $comprador @('price')
if ($n.Valor -and $p.Valor) {
    Resultado "Evento: $($n.Valor.Trim('"')) · Precio: $(Xlm $p.Valor.Trim('"'))"
} else { FalloInesperado $n }

Titulo '2' '¿El invitado tiene pase?' 'Consulta de solo lectura: no envía ninguna transacción.'
$r = Invocar $comprador @('pass_of', '--buyer', $comprador)
switch ($r.Valor) {
    'null' { Resultado 'Todavía no tiene pase.' }
    default { Resultado "Estado actual del pase: $($r.Valor)" 'Yellow' }
}

Titulo '3' 'El invitado compra su pase' 'El invitado firma. El contrato le cobra 1 XLM, se lo paga al anfitrión y registra su pase.'
$compra = Invocar $comprador @('buy', '--buyer', $comprador) -Escribe
if ($compra.Error) { Resultado "Rechazado por el contrato: error #$($compra.Error) $($errores[$compra.Error])" 'Red' }
elseif ($compra.Tx -or $Ensayo) { Resultado $(if ($Ensayo) { 'Compra simulada: saldría bien (no se envió).' } else { 'Compra confirmada: el invitado ya tiene su pase.' }); MostrarEventosYTx $compra }
else { FalloInesperado $compra }

Titulo '4' 'El anfitrión lo deja entrar al Meet' 'Solo el anfitrión puede firmar el check-in. El pase pasa de comprado (Bought) a usado (Used).'
$entrada = Invocar $anfitrion @('check_in', '--buyer', $comprador) -Escribe
if ($entrada.Error) { Resultado "Rechazado por el contrato: error #$($entrada.Error) $($errores[$entrada.Error])" 'Red' }
elseif ($entrada.Tx -or $Ensayo) { Resultado $(if ($Ensayo) { 'Check-in simulado (no se envió).' } else { 'Entrada registrada: el pase ya está usado.' }); MostrarEventosYTx $entrada }
else { FalloInesperado $entrada }

Titulo '5' 'Intento de entrar otra vez con el mismo pase' 'Es el mismo comando del paso 4.'
$otra = Invocar $anfitrion @('check_in', '--buyer', $comprador) -Escribe
if ($otra.Error) {
    Resultado "Rechazado por el contrato: error #$($otra.Error) $($errores[$otra.Error])" 'Red'
    Write-Host '     · La simulación falló, así que la transacción no se envió a la red.' -ForegroundColor Gray
}
elseif ($otra.Tx) { Resultado 'Se aceptó un segundo check-in: esto no debería pasar.' 'Red' }
else { FalloInesperado $otra }

Titulo '6' 'Estado final del pase' 'Otra consulta de solo lectura.'
$r = Invocar $comprador @('pass_of', '--buyer', $comprador)
switch ($r.Valor) {
    '"Used"' { Resultado 'Used: el pase ya se usó.' }
    '"Bought"' { Resultado 'Bought: comprado, todavía sin usar.' 'Yellow' }
    'null' { Resultado 'Sin pase.' 'Yellow' }
    default { FalloInesperado $r }
}

Write-Host ''
Write-Host ' Ver todo en el explorador (stellar.expert)' -ForegroundColor Cyan
Write-Host '   Se abren tres pestañas: la compra, el check-in y el storage del contrato.' -ForegroundColor Gray
Esperar
foreach ($url in @($compra.Tx, $entrada.Tx, "https://stellar.expert/explorer/testnet/contract/$contratoId/storage")) {
    if ($url) {
        Start-Process $url
        Start-Sleep -Milliseconds 700
    }
}
