import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';

const SUPABASE_URL = 'https://dwnohpdgyhsinmnnzmyc.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR3bm9ocGRneWhzaW5tbm56bXljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDk2ODA3MDQsImV4cCI6MjA2NTI1NjcwNH0.q5oyCNRgcFZEtDT2PUyzBGjy-klTSCO59oGiG5cEYwI';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

const API_URL = 'https://lista-backend-pqke.onrender.com';

const loginSection = document.getElementById('login-section');
const main = document.getElementById('main');
const nomeInput = document.getElementById('input-nome');
const telefoneInput = document.getElementById('input-telefone');
const listaComidas = document.getElementById('lista-comidas');
const btnLogin = document.getElementById('btn-login');

btnLogin.addEventListener('click', async () => {
  const nome = nomeInput.value.trim();
  const telefone = telefoneInput.value.trim();

  if (!nome || !telefone) {
    Swal.fire({
      icon: 'warning',
      title: 'Oops...',
      text: 'Preencha nome completo e telefone.',
    });
    return;
  }

  try {
    const res = await fetch(`${API_URL}/usuarios`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, telefone }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro ao autenticar usuário');

    window.usuarioLogado = { nome, telefone };

    loginSection.classList.add('hidden');
    main.classList.remove('hidden');

    carregarComidas();
    iniciarRealtime();
  } catch (e) {
    Swal.fire({
      icon: 'error',
      title: 'Erro',
      text: e.message,
    });
  }
});

async function carregarComidas() {
  try {
    const { nome, telefone } = window.usuarioLogado;
    const res = await fetch(`${API_URL}/comidas-usuario`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nome, telefone }),
    });
    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || 'Erro ao carregar comidas');
    }

    const { comidas } = await res.json();

    listaComidas.innerHTML = '';
    comidas.forEach(item => {
      const card = document.createElement('div');
      card.className = `flex justify-between items-center px-6 py-4 border-t ${item.quantidade_disponivel === 0 ? 'opacity-50' : ''}`;

      const icon = document.createElement('span');
      icon.className = `cursor-pointer text-2xl ${item.reservado ? 'text-green-600' : 'text-yellow-600'}`;
      icon.title = item.reservado ? 'Clique para cancelar reserva' : 'Clique para reservar';
      icon.innerHTML = item.reservado ? '✔️' : '+';

      if (item.quantidade_disponivel === 0 && !item.reservado) {
        icon.style.cursor = 'not-allowed';
        icon.classList.remove('text-yellow-600');
        icon.classList.add('text-gray-400');
      } else {
        icon.addEventListener('click', () => toggleReserva(item));
      }

      // Agora, em vez de mostrar "Disponível", mostramos os nomes dos usuários que reservaram
      const reservados = item.reservados.length > 0 ? item.reservados.map(nome => `<span class="reservado">${nome}</span>`).join(', ') : 'Ninguém';

      card.innerHTML = `
        <div>
          <p class="font-medium text-yellow-800">${item.nome}</p>
          <p class="text-sm text-gray-500">Reservado: ${reservados}</p>
        </div>
      `;
      card.appendChild(icon);

      listaComidas.appendChild(card);
    });
  } catch (e) {
    listaComidas.innerHTML = `<p class="p-4 text-red-600">${e.message}</p>`;
  }
}

async function toggleReserva(item) {
  const { nome, telefone } = window.usuarioLogado;
  if (!nome || !telefone) {
    Swal.fire({
      icon: 'warning',
      title: 'Usuário não autenticado',
      text: 'Faça login antes de reservar',
    });
    return;
  }

  try {
    if (item.reservado) {
      const res = await fetch(`${API_URL}/comidas/${item.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, telefone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao cancelar reserva');
      Swal.fire({
        icon: 'success',
        title: 'Reserva cancelada',
        timer: 1500,
        showConfirmButton: false,
      });
    } else {
      const res = await fetch(`${API_URL}/comidas/${item.id}/reservar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome, telefone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao reservar item');
      Swal.fire({
        icon: 'success',
        title: 'Reserva feita',
        timer: 1500,
        showConfirmButton: false,
      });
    }

    // Recarrega comidas para atualizar UI
    carregarComidas();
  } catch (e) {
    Swal.fire({
      icon: 'error',
      title: 'Erro',
      text: e.message,
    });
  }
}

function iniciarRealtime() {
  // Canal realtime na tabela comidas_festa (esquema public)
  const channel = supabase.channel('public:comidas_festa');

  channel.on(
    'postgres_changes',
    { event: '*', schema: 'public', table: 'comidas_festa' },
    (payload) => {
      console.log('Mudança detectada na comidas_festa:', payload);
      // Atualiza lista de comidas quando qualquer mudança ocorrer
      carregarComidas();
    }
  );

  const subscription = channel.subscribe();

  if (subscription) {
    console.log('Inscrito no canal realtime comidas_festa');
  } else {
    console.error('Falha na inscrição no canal realtime');
  }
}


