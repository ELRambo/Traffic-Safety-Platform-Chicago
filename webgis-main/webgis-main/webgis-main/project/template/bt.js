document.getElementById('roadBtn').addEventListener('click', function() {
    // Toggle the display of the dropdown
    var dropdown = document.getElementById('neighborhoodDropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    
    // Fetch neighborhoods from server
    fetch('/getNeighborhoods')  // 确保路径正确
    .then(response => response.json())
    .then(data => {
        var container = document.getElementById('neighborhoodsContainer');
        container.innerHTML = '';  // 清空之前的复选框

        data.forEach(function(item) {
            // 创建复选框
            var checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.value = item.pri_neigh;  // 使用 `pri_neigh` 作为值
            checkbox.id = item.pri_neigh;  // 为每个复选框设置唯一 ID
            
            // 创建标签
            var label = document.createElement('label');
            label.htmlFor = item.pri_neigh;  // 关联标签与复选框
            label.textContent = item.pri_neigh;

            // 将复选框和标签添加到容器
            container.appendChild(checkbox);
            container.appendChild(label);
            container.appendChild(document.createElement('br'));  // 添加换行
        });
    })
    .catch(error => console.error('Error fetching neighborhoods:', error));

  });
  

document.getElementById('dateBtn').addEventListener('click', function() {
    const dropdown = document.getElementById('dateDropdown');
    dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
});

document.addEventListener('DOMContentLoaded', () => {
    // 你的 Flatpickr 初始化代码和其他逻辑
    flatpickr("#dateRange", {
        mode: "range",
        onClose: (selectedDates) => {
            if (selectedDates.length === 2) {
                // 使用 toLocaleDateString 方法获取格式化的日期
                const startDate = selectedDates[0].toLocaleDateString('en-US');
                const endDate = selectedDates[1].toLocaleDateString('en-US');

                const dateRange = document.getElementById('dateRange'); // 确保使用正确的 ID
                if (dateRange) {
                    dateRange.value = `${startDate} - ${endDate}`; // 使用格式化的日期
                    console.log(dateRange.value);
                } else {
                    console.error('Element with id "dateRange" not found');
                }
            } else {
                console.error('Please select both start and end dates');
            }
        },
    });
});




// 获取选中的邻里
function getSelectedNeighborhoods() {
    const checkboxes = document.querySelectorAll('#neighborhoodsContainer input[type="checkbox"]');
    const selectedNeighborhoods = [];
  
    checkboxes.forEach(checkbox => {
      if (checkbox.checked) {
        selectedNeighborhoods.push(checkbox.value); // 将选中的邻里的值添加到数组
      }
    });
  
    return selectedNeighborhoods; // 返回包含所选邻里的数组
  }



  document.getElementById('confirmBtn').addEventListener('click', function() {
    // 获取选择的邻里
    const selectedNeighborhoods = getSelectedNeighborhoods();
    console.log(selectedNeighborhoods);
  
    // 获取日期范围
    const dateRange = document.getElementById('dateRange').value.split(' - '); // 假设格式为 "开始日期 to 结束日期"
    const startDate = new Date(dateRange[0]);
    const endDate = new Date(dateRange[1]);
    console.log(startDate);
    console.log(endDate);
  
    // 计算选择的天数
    const timeDifference = endDate - startDate;
    const daysSelected = Math.ceil(timeDifference / (1000 * 60 * 60 * 24)) + 1; // 计算天数（包含开始和结束日）
  
    // 如果没有选中邻里或没有选择日期范围，给出提示
    if (selectedNeighborhoods.length === 0 || isNaN(startDate) || isNaN(endDate)) {
      alert('Please select at least one neighborhood and a date range.');
      return;
    }

    // 初始化存储所有邻里的事故数量
    const crashCounts = {};
    const totalCrashes = Array(selectedNeighborhoods.length).fill(0); // 用于存储总事故数
    var index = 0

    // 为每个选中的邻里发送请求
    const fetchPromises = selectedNeighborhoods.map(neighborhood => {
        // 打印出输入的参数
        console.log(`Fetching data for neighborhood: ${neighborhood}`);
        console.log(`Start Date: ${startDate}, End Date: ${endDate}`);
    
        return fetch(`/api/get_crashes_byNeighbourhood_geojson_byday?start_date=${dateRange[0]}&end_date=${dateRange[1]}&neigh=${neighborhood}`)
            .then(response => {
                if (!response.ok) {
                    throw new Error(`Error fetching data for neighborhood: ${neighborhood}`);
                }
                return response.json();
            })
            .then(data => {
                console.log(data); // 打印 data 查看其结构
                if (!data || data.length === 0) {
                    console.error('No features in the response:', data);
                    crashCounts[neighborhood] = Array(daysSelected).fill(0); // 如果没有数据，填充为 0，长度为选择的天数
                    return;
                }
                crashCounts[neighborhood] = data; // 直接使用返回的数据

                // 计算总事故数
                totalCrashes[++index] = data.reduce((acc, count) => acc + count, 0);
            })
            .catch(error => console.error('Error fetching crash data:', error));
    });
    
    // 等待所有请求完成
    Promise.all(fetchPromises)
    .then(() => {
        // 更新 Chart.js 数据集
        const datasets = [];
        
        // 获取开始和结束日期
        const startDate = new Date(dateRange[0]);
        const endDate = new Date(dateRange[1]);
        const dateLabels = []; // 用于存储日期标签


        // 生成日期标签
        const currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            dateLabels.push(currentDate.toLocaleDateString('en-US')); // 添加日期标签
            currentDate.setDate(currentDate.getDate() + 1); // 移动到下一个日期
        }

        // 为每个选中的邻里生成数据集
        for (const [hood, counts] of Object.entries(crashCounts)) {
            datasets.push({
                label: hood,
                borderColor: getRandomColor(), // 生成随机颜色
                pointBackgroundColor: getRandomColor(),
                pointRadius: 0,
                backgroundColor: getRandomColor(),
                fill: false,
                borderWidth: 2,
                data: counts // 直接使用每天的事故数量
            });
        }

        // 更新图表数据
        statisticsChart.data.labels = dateLabels; // 更新标签为生成的日期标签
        statisticsChart.data.datasets = datasets; // 更新数据集
        statisticsChart.update(); // 更新图表

        // 计算并更新总事故数
        // 提取字符串中的数字并进行相加
        console.log(totalCrashes)
        const overallTotal = totalCrashes.reduce((acc, count) => acc + count, 0);
        console.log(overallTotal)
        const cardTitleElement = document.getElementById('Totalcrashes');
        if (cardTitleElement) {
            cardTitleElement.textContent = overallTotal.toLocaleString(); // 更新卡片标题为总事故数
        }
        
        // 更新日期范围显示
        const formattedStartDate = startDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        const formattedEndDate = endDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });
        document.getElementById('daterange1').innerText = `${formattedStartDate} - ${formattedEndDate}`;
        
    });

});

// 生成随机颜色的函数
function getRandomColor() {
    const letters = '0123456789ABCDEF';
    let color = '#';
    for (let i = 0; i < 6; i++) {
        color += letters[Math.floor(Math.random() * 16)];
    }
    return color;
}
