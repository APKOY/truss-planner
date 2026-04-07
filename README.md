TrussPlanner

## Para acesso
https://truss-planner-wwal.vercel.app

Planeamento Avançado de Estruturas Box Truss para Eventos

O TrussPlanner Pro é uma aplicação web intuitiva e poderosa, desenvolvida em React, focada no design, cálculo e visualização de estruturas metálicas (Box Truss) utilizadas em eventos, feiras, palcos e espetáculos.

Com foco na produtividade, a ferramenta permite criar pórticos e estruturas complexas através de um sistema de arrastar e soltar, gerando instantaneamente cálculos de engenharia básicos, listas de materiais e visualizações 3D prontas para apresentação a clientes.

✨ Principais Funcionalidades

🛠️ Desenho 2D Interativo (CAD-like): Vistas em Planta (Topo) e Elevação (Frontal).

Sistema de "Magnetic Snap" (Encaixe Automático) para alinhar múltiplas estruturas facilmente.

Suporte a atalhos de teclado (Ctrl+Z, Ctrl+C, Ctrl+V, Ctrl+X).

🧊 Visualização 3D e Modo Apresentação: Geração instantânea da estrutura em 3D usando Three.js.

Modo Showcase (Apresentação) com iluminação aprimorada, auto-rotação e métricas de projeto, ideal para mostrar a clientes finais.

Controlos touch-friendly (zoom com dois dedos, rotação e pan).

📋 Orçamentação e Lista de Materiais (BOM): Cálculo exato e em tempo real de todas as peças necessárias (Truss de 20cm a 300cm).

Contagem automática de cubos (corners), suportes intermediários, uniões e estimativa de parafusos.

✂️ Gestão de Stock e Cortes: Selecione quais os tamanhos de peças disponíveis no seu armazém.

Ferramenta de divisão manual: clique em qualquer secção longa para a dividir em peças menores baseadas no seu stock real.

📄 Exportação Profissional (PDF): Geração de relatórios técnicos e orçamentos em formato A4 Paisagem, contendo a planta cotada e a lista completa de materiais.

💾 Gestão Local de Projetos: Guarde, carregue e organize os seus projetos diretamente no Local Storage do navegador.

🚀 Tecnologias Utilizadas

Este projeto foi construído com ferramentas modernas do ecossistema front-end:

React (com Hooks para gestão complexa de estado)

Tailwind CSS (Para UI responsiva e moderna)

Three.js (Para a renderização e ambiente 3D)

Lucide React (Ícones da interface)

html2pdf.js (Para conversão do DOM e relatórios em PDF)

🧠 Como funciona o Algoritmo (Truss Solver)

O coração matemático do TrussPlanner Pro utiliza um algoritmo de Programação Dinâmica (Knapsack problem adaptado) para calcular a forma mais eficiente de preencher uma distância X, Y ou Z utilizando as peças disponíveis no inventário (stock) do utilizador. Ele minimiza o número de conexões garantindo que a estrutura atinge o tamanho exato solicitado sempre que possível.

🤝 Contribuição

Contribuições, problemas (issues) e pedidos de novas funcionalidades (feature requests) são muito bem-vindos!
Sinta-se à vontade para verificar a página de issues.

Faça um Fork do projeto

Crie a sua Feature Branch (git checkout -b feature/NovaFuncionalidade)

Faça o Commit das suas alterações (git commit -m 'Adiciona NovaFuncionalidade')

Faça o Push para a Branch (git push origin feature/NovaFuncionalidade)

Abra um Pull Request

📄 Licença

Este projeto está sob a licença MIT. Veja o ficheiro LICENSE para mais detalhes.

Feito com ❤️ para facilitar a vida aos profissionais de eventos e audiovisuais.
