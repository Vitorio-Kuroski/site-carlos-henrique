// Política de privacidade (/privacidade/) e termos de uso (/termos/).
// O texto descreve o que o site faz de verdade (src/alunos.js, cursos.js, aulas.js, mensagens.js, blog.js,
// declaracoes.js). Ao mudar o que o site guarda ou quem processa os dados, atualize aqui e a data abaixo.
import { pagina } from "./cursos.js";

const ATUALIZADO = "9 de novembro de 2026";
const EMAIL = "henrique.csouzaa@gmail.com";

function documento(request, { titulo, rotulo, descricao, corpo }) {
    return pagina(request, {
        titulo,
        descricao,
        script: false,
        conteudo: `
        <article class="post legal">
            <header class="caixa post__cabeca">
                <p class="rotulo"><span class="rotulo__linha"></span>${rotulo}</p>
                <h1>${titulo}</h1>
                <p class="post-cartao__data">Última atualização: ${ATUALIZADO}</p>
            </header>
            <div class="caixa">
                <div class="post__texto">
${corpo}
                </div>
            </div>
        </article>`,
    });
}

function privacidade(request) {
    return documento(request, {
        titulo: "Política de privacidade",
        rotulo: "Privacidade",
        descricao: "Quais dados o site do Carlos Henrique guarda, por quê, por quanto tempo e como pedir para ver ou apagar os seus dados.",
        corpo: `
<p>Esta política explica quais dados pessoais o site <strong>henriqueaccountant.com</strong> coleta, para que eles são usados, com quem são compartilhados, por quanto tempo ficam guardados e quais são os seus direitos. Ela segue o Regulamento Geral de Proteção de Dados da União Europeia (GDPR) e, para quem está no Brasil, a Lei Geral de Proteção de Dados (LGPD).</p>

<h2>Quem é o responsável pelos dados</h2>
<p>O responsável pelos dados é <strong>Carlos Henrique de Souza</strong>, Part-Qualified Accountant, com base em Dublin, Irlanda. Para qualquer assunto sobre os seus dados, escreva para <a href="mailto:${EMAIL}">${EMAIL}</a> ou use o botão <strong>Ajuda</strong> na área do aluno.</p>

<h2>Quais dados coletamos e para quê</h2>
<h3>Conta de aluno</h3>
<ul>
<li><strong>O que:</strong> nome, e-mail e senha. A senha nunca fica guardada como você digitou: guardamos só uma versão embaralhada (hash), que não permite descobrir a senha. Também guardamos a data do cadastro e do último acesso.</li>
<li><strong>Para quê:</strong> criar e manter a sua conta, dar acesso aos cursos e recuperar a senha quando você pedir.</li>
<li><strong>Base legal:</strong> execução do contrato (o serviço que você pediu ao criar a conta).</li>
</ul>
<h3>Compras de cursos</h3>
<ul>
<li><strong>O que:</strong> o curso comprado, o valor, a data, a situação do pagamento e o número do pagamento no Mercado Pago.</li>
<li><strong>Não recebemos os dados do seu cartão, do Pix ou do boleto:</strong> o pagamento acontece no site do Mercado Pago, que trata esses dados sob a política de privacidade dele.</li>
<li><strong>Para quê:</strong> liberar o curso, registrar a venda e cumprir obrigações fiscais e contábeis.</li>
<li><strong>Base legal:</strong> execução do contrato e cumprimento de obrigação legal.</li>
</ul>
<h3>Aulas, progresso e mensagens</h3>
<ul>
<li><strong>O que:</strong> quais aulas você marcou como concluídas e as mensagens que você troca com o Carlos pelo botão Ajuda.</li>
<li><strong>Para quê:</strong> mostrar o seu progresso, responder às suas dúvidas e avisar por e-mail quando chega uma resposta.</li>
<li><strong>Base legal:</strong> execução do contrato.</li>
</ul>
<h3>Pedido de declaração de imposto</h3>
<ul>
<li><strong>O que:</strong> as respostas do formulário: nome, e-mail, telefone ou WhatsApp (opcional), o serviço, os anos de imposto, estado civil, acesso à Revenue, situações como aluguel ou despesas médicas, e a mensagem que você escrever.</li>
<li><strong>O que pedimos para você não enviar:</strong> PPSN, senhas e documentos. O formulário recusa textos que parecem um PPSN. Se algum documento for necessário, combinamos por e-mail a forma segura de enviar.</li>
<li><strong>Para quê:</strong> analisar o seu caso, entrar em contato e, se você quiser, fazer o orçamento e a declaração.</li>
<li><strong>Base legal:</strong> medidas a seu pedido antes de um contrato.</li>
</ul>
<h3>Segurança e prevenção de abuso</h3>
<ul>
<li><strong>O que:</strong> registro das tentativas de login com senha errada (o e-mail e o horário), apagado depois de 15 minutos. No formulário de declaração, um código calculado a partir da sua conexão e do dia, que não permite descobrir o seu endereço IP, só para limitar envios repetidos por robôs.</li>
<li><strong>Base legal:</strong> interesse legítimo em manter o site seguro.</li>
</ul>

<h2>Cookies</h2>
<p>O site usa apenas cookies necessários. Não usamos cookies de publicidade nem de rastreamento.</p>
<ul>
<li><strong><code>sessao</code>:</strong> mantém você conectado à sua conta por até 30 dias (ou até você sair). É obrigatório para a área do aluno funcionar.</li>
<li><strong><code>idioma</code>:</strong> lembra se você escolheu o site em português ou em inglês, por 1 ano.</li>
</ul>
<p>O editor do blog, usado só pelos administradores, guarda uma cópia do texto no próprio navegador para não perder o que foi escrito.</p>

<h2>Com quem compartilhamos</h2>
<p>Não vendemos os seus dados. Eles são tratados por estes prestadores de serviço, só na medida necessária para o site funcionar:</p>
<ul>
<li><strong>Cloudflare:</strong> hospedagem do site e banco de dados onde os dados ficam guardados.</li>
<li><strong>Mercado Pago:</strong> processamento dos pagamentos dos cursos.</li>
<li><strong>Resend:</strong> envio dos e-mails automáticos (senha nova, avisos de mensagem, confirmação de pedido).</li>
<li><strong>Google Fonts:</strong> as fontes do site são carregadas dos servidores do Google, que recebem o endereço IP de quem visita.</li>
<li><strong>Serviço de vídeo das aulas</strong> (por exemplo Vimeo, YouTube, Bunny ou Cloudflare Stream): quando você assiste a uma aula, o vídeo é carregado do serviço escolhido para aquele curso.</li>
</ul>
<p>Alguns desses prestadores podem guardar dados fora da União Europeia. Nesses casos, a transferência é feita com as garantias previstas no GDPR, como as cláusulas contratuais padrão da Comissão Europeia.</p>
<p>Os links para Instagram e LinkedIn só levam você a essas redes. Ao abrir, valem as políticas delas.</p>

<h2>Por quanto tempo guardamos</h2>
<ul>
<li><strong>Conta, progresso e mensagens:</strong> enquanto a conta existir. Você pode pedir para apagar a qualquer momento.</li>
<li><strong>Registros de compras:</strong> por 6 anos, porque a lei fiscal da Irlanda exige guardar os registros de venda. Por isso, a conta de quem comprou um curso não é apagada por inteiro antes desse prazo: os dados que não são necessários para o registro da venda são removidos.</li>
<li><strong>Pedidos de declaração:</strong> enquanto o atendimento estiver em andamento e, depois, por até 2 anos para eventuais dúvidas sobre o serviço, a não ser que você peça para apagar antes. Se você contratar a declaração, os registros desse serviço seguem os prazos fiscais.</li>
<li><strong>Sessões e links de senha nova:</strong> a sessão vale 30 dias; o link de senha nova vale 1 hora e só pode ser usado uma vez.</li>
</ul>

<h2>Os seus direitos</h2>
<p>Você pode, a qualquer momento:</p>
<ul>
<li>pedir uma cópia dos dados que temos sobre você;</li>
<li>corrigir dados errados;</li>
<li>pedir para apagar os seus dados (respeitando os prazos legais acima);</li>
<li>pedir os seus dados num formato que possa levar para outro serviço;</li>
<li>se opor a um uso dos seus dados ou pedir para limitar esse uso.</li>
</ul>
<p>Para isso, escreva para <a href="mailto:${EMAIL}">${EMAIL}</a>. Respondemos em até 30 dias. Se não ficar satisfeito, você pode reclamar à autoridade de proteção de dados da Irlanda, a <a href="https://www.dataprotection.ie" target="_blank" rel="noopener">Data Protection Commission</a>, ou, se estiver no Brasil, à <a href="https://www.gov.br/anpd" target="_blank" rel="noopener">ANPD</a>.</p>

<h2>Segurança</h2>
<p>O site usa conexão segura (HTTPS), senhas guardadas com hash, sessão em cookie protegido, bloqueio depois de várias senhas erradas e acesso ao painel só para administradores. Nenhum sistema é 100% seguro, mas se acontecer um incidente que coloque os seus dados em risco, avisamos você e as autoridades como a lei exige.</p>

<h2>Menores de idade</h2>
<p>O site e os cursos são para maiores de 18 anos. Não coletamos dados de menores de propósito.</p>

<h2>Mudanças nesta política</h2>
<p>Se esta política mudar, a data no topo é atualizada. Se a mudança for importante, avisamos por e-mail quem tem conta.</p>

<p>Veja também os <a href="/termos/">termos de uso</a>.</p>`,
    });
}

function termos(request) {
    return documento(request, {
        titulo: "Termos de uso",
        rotulo: "Termos",
        descricao: "Regras de uso do site, da conta de aluno, da compra de cursos, do reembolso e do serviço de declaração de imposto do Carlos Henrique.",
        corpo: `
<p>Estes termos valem para o uso do site <strong>henriqueaccountant.com</strong>, da conta de aluno, dos cursos e do pedido de declaração de imposto, oferecidos por <strong>Carlos Henrique de Souza</strong>, Part-Qualified Accountant, Dublin, Irlanda. Ao criar uma conta ou comprar um curso, você concorda com estes termos e com a <a href="/privacidade/">política de privacidade</a>.</p>

<h2>Conteúdo educativo</h2>
<p>Os posts, os vídeos, as aulas e os materiais do site são <strong>educativos</strong>. Eles explicam regras gerais e não substituem uma orientação individual sobre o seu caso. As regras de impostos mudam; confira sempre as informações oficiais da Revenue e, para decisões importantes, peça uma análise do seu caso.</p>

<h2>Conta de aluno</h2>
<ul>
<li>Você precisa ter 18 anos ou mais e informar um nome e um e-mail verdadeiros.</li>
<li>A conta é pessoal: não compartilhe a sua senha nem o acesso aos cursos.</li>
<li>Você é responsável pelo que acontece na sua conta. Se perceber um acesso que não foi seu, troque a senha em "Esqueci minha senha" e avise pelo botão Ajuda.</li>
<li>Podemos suspender ou encerrar contas usadas para fraude, para compartilhar o conteúdo pago ou para prejudicar o site ou outras pessoas.</li>
</ul>

<h2>Cursos</h2>
<ul>
<li><strong>Preço e pagamento:</strong> o preço aparece na página de cada curso, em reais (R$), e o pagamento é feito pelo Mercado Pago (Pix, cartão de crédito ou boleto). O acesso é liberado assim que o Mercado Pago confirma o pagamento; no boleto, isso pode levar até 3 dias úteis.</li>
<li><strong>Acesso:</strong> o curso fica disponível na sua área do aluno enquanto o curso e a plataforma estiverem no ar. Se um curso for encerrado, avisamos com pelo menos 30 dias de antecedência.</li>
<li><strong>Uso pessoal:</strong> o acesso é só seu. É proibido gravar, baixar, copiar, revender ou compartilhar as aulas e os materiais, no todo ou em parte.</li>
<li><strong>Atualizações:</strong> o conteúdo pode ser atualizado e melhorado ao longo do tempo, por exemplo quando as regras de imposto mudam.</li>
</ul>

<h2>Arrependimento e reembolso</h2>
<ul>
<li>Você pode desistir da compra em até <strong>7 dias</strong> contados do pagamento, sem precisar explicar o motivo, e recebe o valor total de volta.</li>
<li>Para pedir, escreva pelo botão <strong>Ajuda</strong> na área do aluno ou para <a href="mailto:${EMAIL}">${EMAIL}</a>. O reembolso é feito pelo Mercado Pago, no mesmo meio de pagamento; o prazo para o dinheiro aparecer depende do meio usado e do banco.</li>
<li>Com o reembolso, o acesso ao curso é encerrado automaticamente.</li>
<li>Depois de 7 dias, analisamos cada caso, por exemplo quando há um problema técnico que impede o acesso.</li>
</ul>

<h2>Pedido de declaração de imposto</h2>
<ul>
<li>Enviar o formulário <strong>não cria um contrato nem uma cobrança</strong>. Depois de analisar as suas respostas, o Carlos entra em contato por e-mail com as próximas etapas e, se for o caso, o valor do serviço. O serviço só começa depois que você concordar.</li>
<li>A declaração depende das informações e dos documentos que você fornecer. Você é responsável por informar dados verdadeiros e completos.</li>
<li>Não envie PPSN, senhas nem documentos pelo formulário ou pelas mensagens do site. Quando forem necessários, combinamos por e-mail a forma segura de enviar.</li>
<li>Você continua responsável pelo acesso à sua conta da Revenue (myAccount ou ROS) e pelos prazos que a Revenue definir.</li>
</ul>

<h2>Mensagens e conteúdo que você envia</h2>
<p>Use o botão Ajuda e o formulário com respeito. Não envie conteúdo ilegal, ofensivo, propaganda ou dados de outras pessoas sem autorização.</p>

<h2>Propriedade intelectual</h2>
<p>Os textos, vídeos, aulas, materiais, a marca e o visual do site pertencem ao Carlos Henrique ou são usados com autorização. Você pode compartilhar o link dos posts do blog à vontade; para reproduzir o conteúdo, peça autorização antes.</p>

<h2>Disponibilidade e responsabilidade</h2>
<ul>
<li>Fazemos o possível para o site ficar no ar sem interrupções, mas pode haver pausas para manutenção ou falhas de serviços de terceiros (hospedagem, pagamentos, vídeos, e-mail).</li>
<li>Não respondemos por decisões tomadas só com base no conteúdo educativo, sem uma análise individual do seu caso.</li>
<li>Nada nestes termos limita os direitos que a lei de defesa do consumidor do seu país garante a você.</li>
</ul>

<h2>Mudanças nestes termos</h2>
<p>Estes termos podem ser atualizados; a data no topo mostra a versão atual. Mudanças importantes são avisadas por e-mail a quem tem conta. Compras feitas antes de uma mudança seguem os termos da data da compra.</p>

<h2>Lei aplicável e contato</h2>
<p>Estes termos seguem a lei da Irlanda, sem tirar a proteção que a lei do país onde você mora garante como consumidor. Dúvidas: <a href="mailto:${EMAIL}">${EMAIL}</a> ou o botão Ajuda na área do aluno.</p>`,
    });
}

export function rotasLegal(request) {
    if (request.method !== "GET" && request.method !== "HEAD") return null;
    const { pathname } = new URL(request.url);
    if (pathname === "/privacidade" || pathname === "/termos") return Response.redirect(new URL(`${pathname}/`, request.url).toString(), 301);
    if (pathname === "/privacidade/") return privacidade(request);
    if (pathname === "/termos/") return termos(request);
    return null;
}
