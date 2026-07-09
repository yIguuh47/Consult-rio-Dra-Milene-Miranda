# Configurar agendamento (Google Apps Script)

Siga estes passos **uma única vez** com a conta `dramilenemiranda@gmail.com`.

## 1. Criar o projeto

1. Acesse [script.google.com](https://script.google.com)
2. **Novo projeto**
3. Renomeie para `EME Agendamentos`
4. Apague o código padrão e cole o conteúdo de `Code.gs`

## 2. Executar o setup

1. No editor, selecione a função `setup` no menu de funções
2. Clique em **Executar**
3. Autorize as permissões (Gmail, Agenda, Planilhas)
4. Vá em **Execuções** e confira o log — anote o link da planilha criada

## 3. Publicar como Web App

1. **Implantar** → **Nova implantação**
2. Tipo: **App da Web**
3. Configurações:
   - **Executar como:** Eu (dramilenemiranda@gmail.com)
   - **Quem tem acesso:** Qualquer pessoa
4. Clique em **Implantar**
5. **Copie a URL** gerada (termina em `/exec`)

## 4. Conectar ao site

1. Abra `js/config.js` no projeto do site
2. Cole a URL no campo `APPS_SCRIPT_URL`:

```javascript
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/SEU_ID/exec';
```

3. Faça commit e push para o GitHub — o site passa a usar o agendamento automaticamente

## 5. Testar

1. Acesse o site e preencha o formulário de agendamento
2. Verifique o e-mail da Dra. com links **Confirmar** / **Recusar**
3. Ao confirmar, o evento aparece no Google Agenda e o paciente recebe o convite

## Fluxo resumido

```
Paciente preenche formulário no site
        ↓
E-mail para paciente: "Recebemos sua solicitação"
E-mail para Dra.: links Confirmar / Recusar
        ↓
Dra. clica em Confirmar
        ↓
Evento de 60 min no Google Agenda + convite ao paciente
E-mail para paciente: "Consulta confirmada"
```

## Atualizar o script depois

Se alterar `Code.gs`, crie uma **Nova versão** em **Implantar → Gerenciar implantações → Editar → Nova versão**. A URL permanece a mesma.

## Problemas comuns

### "Erro de conexão" ou "servidor não está respondendo"

A URL do Web App está inválida ou sem acesso público. Faça isto:

1. Abra [script.google.com](https://script.google.com) → projeto **EME Agendamentos**
2. **Implantar → Gerenciar implantações**
3. Clique no ícone de **lápis (Editar)** na implantação ativa
4. Confirme:
   - **Executar como:** Eu (`dramilenemiranda@gmail.com`)
   - **Quem tem acesso:** **Qualquer pessoa** (não "Qualquer pessoa com conta Google")
5. Selecione **Nova versão** → **Implantar**
6. **Copie a URL** que termina em `/exec` (não use URL de teste `/dev`)
7. Cole em `js/config.js` e publique no GitHub

### Testar se a URL está correta

Abra a URL do Web App **em aba anônima** (sem login no Google), ou copie exatamente esta URL:

`https://script.google.com/macros/s/SEU_ID/exec`

**Não use** URLs com `/u/0/`, `/u/1/`, `/u/2/` etc. — isso indica que o Chrome abriu com outra conta Google logada e pode mostrar "Não foi possível abrir o arquivo" mesmo com a implantação correta.

Deve aparecer:

> **EME Agendamentos** — Sistema de agendamento ativo.

### "Execute a função setup()"

No editor do Apps Script, selecione a função `setup` e clique em **Executar** (uma única vez). Isso cria a planilha de agendamentos necessária para o sistema funcionar.
